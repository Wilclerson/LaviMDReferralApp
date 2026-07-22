import {
  canViewPartnerOwnedResource,
  type CreateReferralInput,
  createReferralSchema,
  normalizePagination,
  type PaginationInput,
} from "@lavimd/shared";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Referral } from "@prisma/client";
import { InMemoryEventBus } from "../common/events/event-bus";
import type { AuthenticatedUser } from "../common/types/authenticated-user";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: InMemoryEventBus,
  ) {}

  async create(input: CreateReferralInput): Promise<Referral> {
    const data = createReferralSchema.parse(input);
    const referral = await this.prisma.referral.create({
      data: {
        partnerId: data.partnerId,
        referralCode: data.referralCode,
        channel: data.channel,
        customerRef: data.customerRef ?? null,
      },
    });

    await this.events.emit("referral.created", {
      referralId: referral.id,
      partnerId: referral.partnerId,
    });
    return referral;
  }

  /** Lists referrals, scoped to the actor's own partner unless they may view any. */
  async listForActor(
    actor: AuthenticatedUser,
    pagination: PaginationInput = {},
  ): Promise<{ items: Referral[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize, offset, limit } = normalizePagination(pagination);
    const where = this.scopeFilter(actor);

    const [items, total] = await Promise.all([
      this.prisma.referral.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      this.prisma.referral.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findByIdForActor(id: string, actor: AuthenticatedUser): Promise<Referral> {
    const referral = await this.prisma.referral.findUnique({ where: { id } });
    if (referral === null) throw new NotFoundException("Referral not found");

    const allowed = canViewPartnerOwnedResource(
      { role: actor.role, partnerId: actor.partnerId ?? undefined, permissions: actor.permissions },
      "referral",
      referral.partnerId,
    );
    if (!allowed) throw new ForbiddenException("Insufficient permissions");
    return referral;
  }

  /**
   * Builds the query filter enforcing owner scoping. A partner without a linked
   * partner record matches nothing rather than everything.
   */
  private scopeFilter(actor: AuthenticatedUser): { partnerId?: string } {
    if (actor.permissions.has("referral.view_any")) return {};
    if (actor.permissions.has("referral.view_own")) {
      return { partnerId: actor.partnerId ?? "__no_partner__" };
    }
    throw new ForbiddenException("Insufficient permissions");
  }
}
