import {
  type AuditAction,
  canViewPartnerOwnedResource,
  type CommissionStatus,
  commissionStatusMachine,
  normalizePagination,
  type PaginationInput,
} from "@lavimd/shared";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Commission, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { InMemoryEventBus } from "../common/events/event-bus";
import type { AuthenticatedUser } from "../common/types/authenticated-user";
import type { AdminActionContext } from "../partners/partners.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CommissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: InMemoryEventBus,
  ) {}

  /**
   * Approving is the gate that makes a commission payable. Nothing is earned
   * before this: the state machine forbids reaching `paid` from `pending_review`.
   */
  approve(id: string, ctx: AdminActionContext): Promise<Commission> {
    return this.transition(id, "approved", "commission.approved", ctx);
  }

  reject(id: string, ctx: AdminActionContext): Promise<Commission> {
    return this.transition(id, "rejected", "commission.rejected", ctx);
  }

  reverse(id: string, ctx: AdminActionContext): Promise<Commission> {
    return this.transition(id, "reversed", "commission.reversed", ctx);
  }

  private async transition(
    id: string,
    to: CommissionStatus,
    action: AuditAction,
    ctx: AdminActionContext,
  ): Promise<Commission> {
    const commission = await this.prisma.commission.findUnique({ where: { id } });
    if (commission === null) throw new NotFoundException("Commission not found");

    const from = commission.status;
    if (!commissionStatusMachine.canTransition(from, to)) {
      throw new BadRequestException(`Cannot transition commission from "${from}" to "${to}"`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.commission.update({
        where: { id },
        data: {
          status: to,
          approvedById: to === "approved" ? ctx.actor.id : commission.approvedById,
          approvedAt: to === "approved" ? new Date() : commission.approvedAt,
        },
      });
      await this.audit.record(
        {
          action,
          actorUserId: ctx.actor.id,
          actorRole: ctx.actor.role,
          ip: ctx.ip,
          entityType: "commission",
          entityId: id,
          previousValue: { status: from },
          newValue: { status: to },
          reason: ctx.reason,
        },
        tx,
      );
      return result;
    });

    // Publish rather than calling the ledger directly — the ledger subscriber
    // reacts to these events.
    if (to === "approved") {
      await this.events.emit("commission.approved", {
        commissionId: updated.id,
        partnerId: updated.partnerId,
        amountMinor: updated.commissionAmountMinor,
        currency: updated.currency,
      });
    }
    if (to === "reversed") {
      await this.events.emit("commission.paid", {
        commissionId: updated.id,
        partnerId: updated.partnerId,
        amountMinor: -updated.commissionAmountMinor,
        currency: updated.currency,
        reversed: true,
      });
    }

    return updated;
  }

  async listForActor(
    actor: AuthenticatedUser,
    pagination: PaginationInput = {},
  ): Promise<{ items: Commission[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize, offset, limit } = normalizePagination(pagination);
    const where = this.scopeFilter(actor);
    const [items, total] = await Promise.all([
      this.prisma.commission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      this.prisma.commission.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findByIdForActor(id: string, actor: AuthenticatedUser): Promise<Commission> {
    const commission = await this.prisma.commission.findUnique({ where: { id } });
    if (commission === null) throw new NotFoundException("Commission not found");

    const allowed = canViewPartnerOwnedResource(
      { role: actor.role, partnerId: actor.partnerId ?? undefined, permissions: actor.permissions },
      "commission",
      commission.partnerId,
    );
    if (!allowed) throw new ForbiddenException("Insufficient permissions");
    return commission;
  }

  /** Owner scoping. An actor with no partner record matches nothing. */
  private scopeFilter(actor: AuthenticatedUser): Prisma.CommissionWhereInput {
    if (actor.permissions.has("commission.view_any")) return {};
    if (actor.permissions.has("commission.view_own")) {
      return actor.partnerId === null ? { partnerId: { in: [] } } : { partnerId: actor.partnerId };
    }
    throw new ForbiddenException("Insufficient permissions");
  }
}
