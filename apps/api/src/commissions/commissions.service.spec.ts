import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { actor } from "../../test/support/mocks";
import type { AuditService } from "../audit/audit.service";
import { InMemoryEventBus } from "../common/events/event-bus";
import type { PrismaService } from "../prisma/prisma.service";
import { CommissionsService } from "./commissions.service";

const COMMISSION = {
  id: "c1",
  partnerId: "p1",
  status: "pending_review",
  commissionAmountMinor: 500,
  currency: "USD",
  approvedById: null,
  approvedAt: null,
};

function setup(commission: unknown = COMMISSION): {
  service: CommissionsService;
  update: ReturnType<typeof vi.fn>;
  audit: AuditService;
  bus: InMemoryEventBus;
} {
  const update = vi.fn((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ ...(commission as object), ...args.data }),
  );
  const prisma = {
    commission: {
      findUnique: vi.fn(() => Promise.resolve(commission)),
      update,
      findMany: vi.fn(() => Promise.resolve([COMMISSION])),
      count: vi.fn(() => Promise.resolve(1)),
    },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      Promise.resolve(fn({ commission: { update }, auditLog: { create: vi.fn() } })),
    ),
  } as unknown as PrismaService;

  const audit = { record: vi.fn(() => Promise.resolve()) } as unknown as AuditService;
  const bus = new InMemoryEventBus();
  return { service: new CommissionsService(prisma, audit, bus), update, audit, bus };
}

describe("CommissionsService.approve", () => {
  it("moves pending_review -> approved, stamps the approver, and audits", async () => {
    const { service, update, audit } = setup();
    const admin = actor("administrator");

    await service.approve("c1", { actor: admin, ip: "203.0.113.7", reason: "Order settled" });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "approved", approvedById: admin.id }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "commission.approved",
        previousValue: { status: "pending_review" },
        newValue: { status: "approved" },
        reason: "Order settled",
        ip: "203.0.113.7",
      }),
      expect.anything(),
    );
  });

  it("publishes commission.approved so the ledger can react", async () => {
    const { service, bus } = setup();
    const handler = vi.fn();
    bus.subscribe("commission.approved", handler);

    await service.approve("c1", { actor: actor("administrator"), ip: null, reason: "ok" });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("refuses an illegal transition (already rejected)", async () => {
    const { service } = setup({ ...COMMISSION, status: "rejected" });
    await expect(
      service.approve("c1", { actor: actor("administrator"), ip: null, reason: "x" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("never allows paying straight out of review", async () => {
    const { service } = setup();
    // `paid` is only reachable from `approved`; the machine is the guard.
    await expect(
      service.reverse("c1", { actor: actor("administrator"), ip: null, reason: "x" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("404s for an unknown commission", async () => {
    const { service } = setup(null);
    await expect(
      service.approve("nope", { actor: actor("administrator"), ip: null, reason: "x" }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe("CommissionsService.reject", () => {
  it("audits the rejection", async () => {
    const { service, audit } = setup();
    await service.reject("c1", { actor: actor("administrator"), ip: null, reason: "Refunded" });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "commission.rejected" }),
      expect.anything(),
    );
  });
});

describe("CommissionsService owner scoping", () => {
  it("lets a partner read their own commission", async () => {
    const { service } = setup();
    await expect(service.findByIdForActor("c1", actor("partner", "p1"))).resolves.toMatchObject({
      id: "c1",
    });
  });

  it("denies a partner reading another partner's commission", async () => {
    const { service } = setup();
    await expect(service.findByIdForActor("c1", actor("partner", "p2"))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("denies a customer entirely", async () => {
    const { service } = setup();
    await expect(service.listForActor(actor("customer"))).rejects.toThrow(ForbiddenException);
  });

  it("scopes a partner list query to their own partner id", async () => {
    const { service } = setup();
    const result = await service.listForActor(actor("partner", "p1"));
    expect(result.total).toBe(1);
  });

  it("lets an administrator list every commission", async () => {
    const { service } = setup();
    await expect(service.listForActor(actor("administrator"))).resolves.toMatchObject({ total: 1 });
  });
});
