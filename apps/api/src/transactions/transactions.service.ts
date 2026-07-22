import {
  type CommissionRule,
  computeRuleCommissionMinor,
  type CreateTransaction,
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
  /** True when this delivery was a replay and no new work was performed. */
  idempotent: boolean;
}

/** Prisma's unique-constraint violation. */
const UNIQUE_VIOLATION = "P2002";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === UNIQUE_VIOLATION
  );
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
    externalEventId?: string,
  ): Promise<ImportTransactionResult> {
    const data = createTransactionSchema.parse(input);

    // Idempotency, checked before any write. A replayed webhook/API delivery or
    // a re-imported order must never create a second transaction or commission.
    const replay = await this.findExistingDelivery(data, externalEventId);
    if (replay !== null) return replay;

    const referral = await this.prisma.referral.findUnique({
      where: { id: data.referralId },
      include: { partner: true },
    });
    if (referral === null) throw new NotFoundException("Referral not found");

    let transaction: Transaction;
    try {
      transaction = await this.createTransactionWithAudit(data, ctx, externalEventId);
    } catch (error) {
      // Lost a race against a concurrent delivery of the same event: the unique
      // constraint is the source of truth, so re-read and report it as a replay.
      if (isUniqueViolation(error)) {
        const concurrent = await this.findExistingDelivery(data, externalEventId);
        if (concurrent !== null) return concurrent;
      }
      throw error;
    }

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
      return {
        transaction,
        ineligibleReasons: eligibility.reasons,
        commissionId: null,
        idempotent: false,
      };
    }

    const commissionId = await this.raisePendingCommission(transaction, referral.partnerId);
    return { transaction, ineligibleReasons: [], commissionId, idempotent: false };
  }

  /**
   * Returns the already-recorded result for a delivery we have seen before,
   * matched first by event id and then by the source's own order reference.
   */
  private async findExistingDelivery(
    data: { source: Transaction["source"]; externalRef?: string | undefined },
    externalEventId: string | undefined,
  ): Promise<ImportTransactionResult | null> {
    if (externalEventId !== undefined) {
      const seen = await this.prisma.ingestedEvent.findUnique({
        where: { source_externalEventId: { source: data.source, externalEventId } },
        include: { transaction: true },
      });
      if (seen?.transaction != null) {
        return this.replayResult(seen.transaction);
      }
    }

    if (data.externalRef !== undefined) {
      const existing = await this.prisma.transaction.findUnique({
        where: { source_externalRef: { source: data.source, externalRef: data.externalRef } },
      });
      if (existing !== null) return this.replayResult(existing);
    }

    return null;
  }

  private async replayResult(transaction: Transaction): Promise<ImportTransactionResult> {
    const commission = await this.prisma.commission.findFirst({
      where: { transactionId: transaction.id },
      orderBy: { level: "asc" },
    });
    return {
      transaction,
      ineligibleReasons: [],
      commissionId: commission?.id ?? null,
      idempotent: true,
    };
  }

  private async createTransactionWithAudit(
    data: CreateTransaction,
    ctx: AdminActionContext,
    externalEventId: string | undefined,
  ): Promise<Transaction> {
    return this.prisma.$transaction(async (tx) => {
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

      // Recorded in the same transaction as the import, so the idempotency
      // marker can never be written without the work it guards.
      if (externalEventId !== undefined) {
        await tx.ingestedEvent.create({
          data: { source: data.source, externalEventId, transactionId: created.id },
        });
      }

      return created;
    });
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
      return actor.partnerId === null
        ? { referral: { partnerId: { in: [] } } }
        : { referral: { partnerId: actor.partnerId } };
    }
    throw new ForbiddenException("Insufficient permissions");
  }
}
