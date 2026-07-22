import {
  type CommissionRule,
  computeRuleCommissionMinor,
  type CreateTransactionInput,
  createTransactionSchema,
  evaluateTransactionEligibility,
  getCommissionRuleForLevel,
  normalizePagination,
  type PaginationInput,
} from "@lavimd/shared";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma, Transaction } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { InMemoryEventBus } from "../common/events/event-bus";
import type { AuthenticatedUser } from "../common/types/authenticated-user";
import type { AdminActionContext } from "../partners/partners.service";
import { PrismaService } from "../prisma/prisma.service";

export interface ImportTransactionResult {
  transaction: Transaction;
  /** Reasons the transaction was not eligible; empty when a commission was raised. */
  ineligibleReasons: string[];
  commissionId: string | null;
}

/** Prisma rule rows use the same shape as the shared domain rule. */
interface PersistedRule {
  level: number;
  calcType: CommissionRule["calcType"];
  rateBasisPoints: number | null;
  flatAmountMinor: number | null;
}

export function toDomainRules(rules: readonly PersistedRule[]): CommissionRule[] {
  return rules.map((rule) => ({
    level: rule.level,
    calcType: rule.calcType,
    rateBasisPoints: rule.rateBasisPoints ?? undefined,
    flatAmountMinor: rule.flatAmountMinor ?? undefined,
  }));
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: InMemoryEventBus,
  ) {}

  /**
   * MVP ingestion path: an administrator imports a transaction by hand.
   *
   * The import itself is audited, then eligibility is evaluated. An eligible
   * transaction raises a commission in `pending_review` — never approved
   * automatically. Nothing is earned until an administrator approves it.
   */
  async importManual(
    input: CreateTransactionInput,
    ctx: AdminActionContext,
  ): Promise<ImportTransactionResult> {
    const data = createTransactionSchema.parse(input);

    const referral = await this.prisma.referral.findUnique({
      where: { id: data.referralId },
      include: { partner: true },
    });
    if (referral === null) throw new NotFoundException("Referral not found");

    const transaction = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          referralId: data.referralId,
          source: data.source,
          externalRef: data.externalRef ?? null,
          amountMinor: data.amountMinor,
          currency: data.currency,
          occurredAt: new Date(data.occurredAt),
          settlementStatus: data.settlementStatus,
          refunded: data.refunded,
          chargedBack: data.chargedBack,
          cancelled: data.cancelled,
        },
      });
      await this.audit.record(
        {
          action: "transaction.imported_manually",
          actorUserId: ctx.actor.id,
          actorRole: ctx.actor.role,
          ip: ctx.ip,
          entityType: "transaction",
          entityId: created.id,
          previousValue: null,
          newValue: { amountMinor: created.amountMinor, currency: created.currency },
          reason: ctx.reason,
        },
        tx,
      );
      return created;
    });

    await this.events.emit("purchase.completed", {
      transactionId: transaction.id,
      referralId: transaction.referralId,
    });

    const eligibility = evaluateTransactionEligibility(
      {
        settlementStatus: transaction.settlementStatus,
        refunded: transaction.refunded,
        chargedBack: transaction.chargedBack,
        cancelled: transaction.cancelled,
      },
      {
        partnerActive: referral.partner.status === "active",
        attributionValid: referral.status !== "cancelled" && referral.status !== "expired",
      },
    );

    if (!eligibility.eligible) {
      return { transaction, ineligibleReasons: eligibility.reasons, commissionId: null };
    }

    const commissionId = await this.raisePendingCommission(transaction, referral.partnerId);
    return { transaction, ineligibleReasons: [], commissionId };
  }

  /** Creates the level-1 commission for an eligible transaction, pending review. */
  private async raisePendingCommission(
    transaction: Transaction,
    partnerId: string,
  ): Promise<string | null> {
    const plan = await this.prisma.commissionPlan.findFirst({
      where: { status: "active", currency: transaction.currency },
      orderBy: { version: "desc" },
      include: { levels: true },
    });
    if (plan === null) return null;

    const rule = getCommissionRuleForLevel(toDomainRules(plan.levels), 1);
    if (rule === undefined) return null;

    const amount = computeRuleCommissionMinor(rule, transaction.amountMinor);

    const commission = await this.prisma.commission.create({
      data: {
        partnerId,
        referralId: transaction.referralId,
        transactionId: transaction.id,
        planId: plan.id,
        planVersion: plan.version,
        level: 1,
        eligibleAmountMinor: transaction.amountMinor,
        commissionAmountMinor: amount,
        currency: transaction.currency,
      },
    });

    await this.events.emit("commission.pending", {
      commissionId: commission.id,
      partnerId,
      amountMinor: amount,
    });
    return commission.id;
  }

  /**
   * Administrator override of a transaction's referral attribution. Always
   * audited with the previous and new attribution.
   */
  async overrideAttribution(
    transactionId: string,
    newReferralId: string,
    ctx: AdminActionContext,
  ): Promise<Transaction> {
    const transaction = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (transaction === null) throw new NotFoundException("Transaction not found");

    const referral = await this.prisma.referral.findUnique({ where: { id: newReferralId } });
    if (referral === null) throw new BadRequestException("Target referral not found");

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: { referralId: newReferralId },
      });
      await this.audit.record(
        {
          action: "attribution.overridden",
          actorUserId: ctx.actor.id,
          actorRole: ctx.actor.role,
          ip: ctx.ip,
          entityType: "transaction",
          entityId: transactionId,
          previousValue: { referralId: transaction.referralId },
          newValue: { referralId: newReferralId },
          reason: ctx.reason,
        },
        tx,
      );
      return updated;
    });
  }

  async listForActor(
    actor: AuthenticatedUser,
    pagination: PaginationInput = {},
  ): Promise<{ items: Transaction[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize, offset, limit } = normalizePagination(pagination);
    const where = this.scopeFilter(actor);
    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip: offset,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** Owner scoping: partners only ever see transactions on their own referrals. */
  private scopeFilter(actor: AuthenticatedUser): Prisma.TransactionWhereInput {
    if (actor.permissions.has("transaction.view_any")) return {};
    if (actor.permissions.has("transaction.view_own")) {
      return { referral: { partnerId: actor.partnerId ?? "__no_partner__" } };
    }
    throw new ForbiddenException("Insufficient permissions");
  }
}
