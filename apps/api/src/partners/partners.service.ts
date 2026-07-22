import {
  type CreatePartnerInput,
  createPartnerSchema,
  normalizePagination,
  type PaginationInput,
  type PartnerStatus,
  partnerStatusMachine,
} from "@lavimd/shared";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Partner } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user";
import { PrismaService } from "../prisma/prisma.service";

export interface AdminActionContext {
  actor: AuthenticatedUser;
  ip: string | null;
  reason: string;
}

@Injectable()
export class PartnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(input: CreatePartnerInput): Promise<Partner> {
    const data = createPartnerSchema.parse(input);
    return this.prisma.partner.create({
      data: {
        displayName: data.displayName,
        category: data.category,
        email: data.email,
        referralCode: data.referralCode,
      },
    });
  }

  async list(pagination: PaginationInput = {}): Promise<{
    items: Partner[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { page, pageSize, offset, limit } = normalizePagination(pagination);
    const [items, total] = await Promise.all([
      this.prisma.partner.findMany({ orderBy: { createdAt: "desc" }, skip: offset, take: limit }),
      this.prisma.partner.count(),
    ]);
    return { items, total, page, pageSize };
  }

  /**
   * Reads a single partner. A partner user may only ever read their own record;
   * cross-partner reads require `partner.view_any`.
   */
  async findByIdForActor(id: string, actor: AuthenticatedUser): Promise<Partner> {
    const canViewAny = actor.permissions.has("partner.view_any");
    if (!canViewAny && actor.partnerId !== id) {
      throw new ForbiddenException("Insufficient permissions");
    }
    return this.getOrThrow(id);
  }

  approve(id: string, ctx: AdminActionContext): Promise<Partner> {
    return this.transition(id, "active", "partner.approved", ctx);
  }

  suspend(id: string, ctx: AdminActionContext): Promise<Partner> {
    return this.transition(id, "suspended", "partner.suspended", ctx);
  }

  private async transition(
    id: string,
    to: PartnerStatus,
    action: "partner.approved" | "partner.suspended",
    ctx: AdminActionContext,
  ): Promise<Partner> {
    const partner = await this.getOrThrow(id);
    const from = partner.status;

    if (!partnerStatusMachine.canTransition(from, to)) {
      throw new BadRequestException(`Cannot transition partner from "${from}" to "${to}"`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.partner.update({
        where: { id },
        data: { status: to },
      });
      await this.audit.record(
        {
          action,
          actorUserId: ctx.actor.id,
          actorRole: ctx.actor.role,
          ip: ctx.ip,
          entityType: "partner",
          entityId: id,
          previousValue: { status: from },
          newValue: { status: to },
          reason: ctx.reason,
        },
        tx,
      );
      return updated;
    });
  }

  private async getOrThrow(id: string): Promise<Partner> {
    const partner = await this.prisma.partner.findUnique({ where: { id } });
    if (partner === null) throw new NotFoundException("Partner not found");
    return partner;
  }
}
