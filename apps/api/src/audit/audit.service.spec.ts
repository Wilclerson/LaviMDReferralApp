import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { AuditService, toPrismaAuditAction } from "./audit.service";

function prismaMock(): { prisma: PrismaService; create: ReturnType<typeof vi.fn> } {
  const create = vi.fn(() => Promise.resolve({}));
  const prisma = {
    auditLog: {
      create,
      findMany: vi.fn(() => Promise.resolve([{ id: "a1" }])),
      count: vi.fn(() => Promise.resolve(1)),
    },
  } as unknown as PrismaService;
  return { prisma, create };
}

const validEntry = {
  action: "commission.approved",
  actorUserId: "11111111-1111-4111-8111-111111111111",
  actorRole: "administrator",
  entityType: "commission",
  entityId: "c1",
  reason: "Order settled and verified",
} as const;

describe("toPrismaAuditAction", () => {
  it("maps dotted domain actions to Prisma enum members", () => {
    expect(toPrismaAuditAction("commission.approved")).toBe("commission_approved");
    expect(toPrismaAuditAction("transaction.imported_manually")).toBe(
      "transaction_imported_manually",
    );
    expect(toPrismaAuditAction("commission_plan.changed")).toBe("commission_plan_changed");
  });
});

describe("AuditService", () => {
  it("records an entry with previous and new values", async () => {
    const { prisma, create } = prismaMock();
    const service = new AuditService(prisma);

    await service.record({
      ...validEntry,
      ip: "203.0.113.7",
      previousValue: { status: "pending_review" },
      newValue: { status: "approved" },
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "commission_approved",
        ip: "203.0.113.7",
        previousValue: { status: "pending_review" },
        newValue: { status: "approved" },
        reason: "Order settled and verified",
      }),
    });
  });

  it("defaults ip and values to null/undefined when unavailable", async () => {
    const { prisma, create } = prismaMock();
    await new AuditService(prisma).record(validEntry);

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ip: null, previousValue: undefined, newValue: undefined }),
    });
  });

  it("refuses to record an entry without a reason", async () => {
    const { prisma } = prismaMock();
    await expect(new AuditService(prisma).record({ ...validEntry, reason: "" })).rejects.toThrow();
  });

  it("writes through a supplied transaction client", async () => {
    const { prisma } = prismaMock();
    const txCreate = vi.fn(() => Promise.resolve({}));
    await new AuditService(prisma).record(validEntry, {
      auditLog: { create: txCreate },
    } as unknown as PrismaService);

    expect(txCreate).toHaveBeenCalledOnce();
  });

  it("exposes no update or delete operation — the trail is append-only", () => {
    const { prisma } = prismaMock();
    const service = new AuditService(prisma);
    expect("update" in service).toBe(false);
    expect("delete" in service).toBe(false);
  });

  it("lists entries newest-first with clamped pagination", async () => {
    const { prisma } = prismaMock();
    const result = await new AuditService(prisma).list({ page: 0, pageSize: 10_000 });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(100);
    expect(result.total).toBe(1);
  });
});
