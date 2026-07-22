import {
  type LedgerEntryType,
  normalizePagination,
  type PaginationInput,
  sumLedgerBalanceMinor,
} from "@lavimd/shared";
import { ForbiddenException, Injectable } from "@nestjs/common";
import type { LedgerEntry, Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../common/types/authenticated-user";
import { PrismaService } from "../prisma/prisma.service";

export interface AppendLedgerEntryInput {
  type: LedgerEntryType;
  partnerId: string;
  /** Signed minor units: positive credits the partner, negative debits. */
  amountMinor: number;
  currency: string;
  referenceId: string;
  occurredAt?: Date;
}

/**
 * The append-only financial ledger.
 *
 * This service exposes **no update or delete operation**: corrections are made
 * by appending an opposite-signed entry, never by editing history.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  append(input: AppendLedgerEntryInput): Promise<LedgerEntry> {
    return this.prisma.ledgerEntry.create({
      data: {
        type: input.type,
        partnerId: input.partnerId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        referenceId: input.referenceId,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
  }

  /** Current balance for a partner, in minor units. */
  async balanceForPartner(partnerId: string): Promise<number> {
    const entries = await this.prisma.ledgerEntry.findMany({ where: { partnerId } });
    return sumLedgerBalanceMinor(
      entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        partnerId: entry.partnerId,
        amountMinor: entry.amountMinor,
        currency: entry.currency,
        referenceId: entry.referenceId,
        occurredAt: entry.occurredAt.toISOString(),
      })),
    );
  }

  async listForActor(
    actor: AuthenticatedUser,
    partnerId: string | undefined,
    pagination: PaginationInput = {},
  ): Promise<{ items: LedgerEntry[]; total: number; page: number; pageSize: number }> {
    const where = this.scopeFilter(actor, partnerId);
    const { page, pageSize, offset, limit } = normalizePagination(pagination);

    const [items, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip: offset,
        take: limit,
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /**
   * Owner scoping. Partners are always forced onto their own id regardless of
   * what they request; an actor with no partner record matches nothing.
   */
  private scopeFilter(
    actor: AuthenticatedUser,
    requested: string | undefined,
  ): Prisma.LedgerEntryWhereInput {
    if (actor.permissions.has("payout.view_any")) {
      return requested === undefined ? {} : { partnerId: requested };
    }
    if (actor.permissions.has("payout.view_own")) {
      return actor.partnerId === null ? { partnerId: { in: [] } } : { partnerId: actor.partnerId };
    }
    throw new ForbiddenException("Insufficient permissions");
  }
}
