import {
  type AuditAction,
  type CreateAuditEntryInput,
  createAuditEntrySchema,
  normalizePagination,
  type PaginationInput,
} from "@lavimd/shared";
import { Injectable } from "@nestjs/common";
import type { AuditAction as PrismaAuditAction, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/** Minimal surface shared by PrismaService and an interactive transaction client. */
export type AuditWriter = Pick<PrismaService, "auditLog">;

/**
 * Maps a domain audit action (`commission.approved`) to its Prisma enum member
 * (`commission_approved`).
 */
export function toPrismaAuditAction(action: AuditAction): PrismaAuditAction {
  return action.replace(/\./g, "_") as PrismaAuditAction;
}

/**
 * Writes the immutable audit trail.
 *
 * This service deliberately exposes **no update or delete operation** — audit
 * entries are append-only. `record` accepts an optional transaction client so an
 * audit entry can be written atomically with the change it describes.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: CreateAuditEntryInput, client: AuditWriter = this.prisma): Promise<void> {
    const entry = createAuditEntrySchema.parse(input);
    await client.auditLog.create({
      data: {
        action: toPrismaAuditAction(entry.action),
        actorUserId: entry.actorUserId,
        actorRole: entry.actorRole,
        ip: entry.ip,
        entityType: entry.entityType,
        entityId: entry.entityId,
        previousValue: (entry.previousValue ?? undefined) as Prisma.InputJsonValue | undefined,
        newValue: (entry.newValue ?? undefined) as Prisma.InputJsonValue | undefined,
        reason: entry.reason,
      },
    });
  }

  async list(pagination: PaginationInput = {}): Promise<{
    items: Awaited<ReturnType<PrismaService["auditLog"]["findMany"]>>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { page, pageSize, offset, limit } = normalizePagination(pagination);
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { occurredAt: "desc" },
        skip: offset,
        take: limit,
      }),
      this.prisma.auditLog.count(),
    ]);
    return { items, total, page, pageSize };
  }
}
