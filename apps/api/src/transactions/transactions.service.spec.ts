import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { actor } from "../../test/support/mocks";
import type { AuditService } from "../audit/audit.service";
import { InMemoryEventBus } from "../common/events/event-bus";
import type { PrismaService } from "../prisma/prisma.service";
import { toDomainRules, TransactionsService } from "./transactions.service";

const REFERRAL = {
  id: "22222222-2222-4222-8222-222222222222",
  partnerId: "p1",
  status: "signed_up",
  partner: { id: "p1", status: "active" },
};

const PLAN = {
  id: "plan-1",
  version: 1,
  currency: "USD",
  levels: [{ level: 1, calcType: "percentage", rateBasisPoints: 1000, flatAmountMinor: null }],
};

const IMPORT_INPUT = {
  referralId: REFERRAL.id,
  source: "manual" as const,
  amountMinor: 5000,
  currency: "USD",
  occurredAt: "2026-07-21T12:00:00.000Z",
  settlementStatus: "settled" as const,
};

function setup(options: { referral?: unknown; plan?: unknown } = {}): {
  service: TransactionsService;
  commissionCreate: ReturnType<typeof vi.fn>;
  audit: AuditService;
  bus: InMemoryEventBus;
} {
  const created = { id: "t1", referralId: REFERRAL.id, amountMinor: 5000, currency: "USD" };
  const transactionCreate = vi.fn((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ ...created, ...args.data }),
  );
  const commissionCreate = vi.fn(() => Promise.resolve({ id: "c1" }));

  const prisma = {
    referral: {
      findUnique: vi.fn(() =>
        Promise.resolve(options.referral === undefined ? REFERRAL : options.referral),
      ),
    },
    commissionPlan: {
      findFirst: vi.fn(() => Promise.resolve(options.plan === undefined ? PLAN : options.plan)),
    },
    commission: { create: commissionCreate },
    transaction: {
      findUnique: vi.fn(() => Promise.resolve({ id: "t1", referralId: "old-referral" })),
      update: vi.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...created, ...args.data }),
      ),
      findMany: vi.fn(() => Promise.resolve([created])),
      count: vi.fn(() => Promise.resolve(1)),
    },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      Promise.resolve(
        fn({
          transaction: {
            create: transactionCreate,
            update: vi.fn((args: { data: Record<string, unknown> }) =>
              Promise.resolve({ ...created, ...args.data }),
            ),
          },
          auditLog: { create: vi.fn() },
        }),
      ),
    ),
  } as unknown as PrismaService;

  const audit = { record: vi.fn(() => Promise.resolve()) } as unknown as AuditService;
  const bus = new InMemoryEventBus();
  return { service: new TransactionsService(prisma, audit, bus), commissionCreate, audit, bus };
}

describe("toDomainRules", () => {
  it("converts nullable persisted columns to optional domain fields", () => {
    expect(
      toDomainRules([{ level: 1, calcType: "flat", rateBasisPoints: null, flatAmountMinor: 250 }]),
    ).toEqual([{ level: 1, calcType: "flat", rateBasisPoints: undefined, flatAmountMinor: 250 }]);
  });
});

describe("TransactionsService.importManual", () => {
  it("audits the import itself", async () => {
    const { service, audit } = setup();
    await service.importManual(IMPORT_INPUT, {
      actor: actor("administrator"),
      ip: "203.0.113.7",
      reason: "Verified order #1234",
    });

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "transaction.imported_manually",
        reason: "Verified order #1234",
        ip: "203.0.113.7",
      }),
      expect.anything(),
    );
  });

  it("raises a pending commission for an eligible transaction (10% of 5000 = 500)", async () => {
    const { service, commissionCreate } = setup();
    const result = await service.importManual(IMPORT_INPUT, {
      actor: actor("administrator"),
      ip: null,
      reason: "ok",
    });

    expect(result.ineligibleReasons).toEqual([]);
    expect(result.commissionId).toBe("c1");
    expect(commissionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ commissionAmountMinor: 500, level: 1 }),
    });
  });

  it("creates the commission in pending_review — never auto-approved", async () => {
    const { service, commissionCreate } = setup();
    await service.importManual(IMPORT_INPUT, {
      actor: actor("administrator"),
      ip: null,
      reason: "ok",
    });

    const call = commissionCreate.mock.calls[0]?.[0] as {
      data: { status?: unknown; approvedById?: unknown };
    };
    // Neither is set, so the row falls back to `pending_review` with no approver.
    expect(call.data.status).toBeUndefined();
    expect(call.data.approvedById).toBeUndefined();
  });

  it("raises no commission when the payment has not settled", async () => {
    const { service, commissionCreate } = setup();
    const result = await service.importManual(
      { ...IMPORT_INPUT, settlementStatus: "pending" },
      { actor: actor("administrator"), ip: null, reason: "ok" },
    );

    expect(result.ineligibleReasons).toContain("payment_not_settled");
    expect(result.commissionId).toBeNull();
    expect(commissionCreate).not.toHaveBeenCalled();
  });

  it("raises no commission for a refunded or charged-back order", async () => {
    const { service } = setup();
    const result = await service.importManual(
      { ...IMPORT_INPUT, refunded: true, chargedBack: true },
      { actor: actor("administrator"), ip: null, reason: "ok" },
    );
    expect(result.ineligibleReasons).toEqual(expect.arrayContaining(["refunded", "charged_back"]));
  });

  it("raises no commission when the partner is not active", async () => {
    const { service } = setup({ referral: { ...REFERRAL, partner: { status: "suspended" } } });
    const result = await service.importManual(IMPORT_INPUT, {
      actor: actor("administrator"),
      ip: null,
      reason: "ok",
    });
    expect(result.ineligibleReasons).toContain("partner_inactive");
  });

  it("raises no commission when the attribution is cancelled", async () => {
    const { service } = setup({ referral: { ...REFERRAL, status: "cancelled" } });
    const result = await service.importManual(IMPORT_INPUT, {
      actor: actor("administrator"),
      ip: null,
      reason: "ok",
    });
    expect(result.ineligibleReasons).toContain("invalid_attribution");
  });

  it("returns no commission when no active plan exists", async () => {
    const { service } = setup({ plan: null });
    const result = await service.importManual(IMPORT_INPUT, {
      actor: actor("administrator"),
      ip: null,
      reason: "ok",
    });
    expect(result.commissionId).toBeNull();
  });

  it("404s for an unknown referral", async () => {
    const { service } = setup({ referral: null });
    await expect(
      service.importManual(IMPORT_INPUT, {
        actor: actor("administrator"),
        ip: null,
        reason: "ok",
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe("TransactionsService.overrideAttribution", () => {
  it("audits the previous and new attribution", async () => {
    const { service, audit } = setup();
    await service.overrideAttribution("t1", REFERRAL.id, {
      actor: actor("administrator"),
      ip: null,
      reason: "Support ticket 42",
    });

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "attribution.overridden",
        previousValue: { referralId: "old-referral" },
        newValue: { referralId: REFERRAL.id },
      }),
      expect.anything(),
    );
  });
});

describe("TransactionsService owner scoping", () => {
  it("denies a customer", async () => {
    const { service } = setup();
    await expect(service.listForActor(actor("customer"))).rejects.toThrow(ForbiddenException);
  });

  it("scopes partners to their own referrals", async () => {
    const { service } = setup();
    await expect(service.listForActor(actor("partner", "p1"))).resolves.toMatchObject({ total: 1 });
  });

  it("lets administrators list everything", async () => {
    const { service } = setup();
    await expect(service.listForActor(actor("administrator"))).resolves.toMatchObject({ total: 1 });
  });
});
