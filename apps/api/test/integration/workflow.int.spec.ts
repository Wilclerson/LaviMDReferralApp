import { resolvePermissions } from "@lavimd/shared";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "../../src/audit/audit.service";
import { CommissionsService } from "../../src/commissions/commissions.service";
import { InMemoryEventBus } from "../../src/common/events/event-bus";
import type { AuthenticatedUser } from "../../src/common/types/authenticated-user";
import { LedgerService } from "../../src/ledger/ledger.service";
import { LedgerSubscriber } from "../../src/ledger/ledger.subscriber";
import { PartnersService } from "../../src/partners/partners.service";
import { ReferralsService } from "../../src/referrals/referrals.service";
import { TransactionsService } from "../../src/transactions/transactions.service";
import {
  createActivePlan,
  createPartner,
  createUser,
  prisma,
  prismaAsService,
  resetDatabase,
} from "./helpers";

const bus = new InMemoryEventBus();
const audit = new AuditService(prismaAsService);
const partners = new PartnersService(prismaAsService, audit);
const referrals = new ReferralsService(prismaAsService, bus);
const transactions = new TransactionsService(prismaAsService, audit, bus);
const commissions = new CommissionsService(prismaAsService, audit, bus);
const ledger = new LedgerService(prismaAsService);
new LedgerSubscriber(bus, ledger).onModuleInit();

/** Narrows a nullable id, failing the test loudly if it is missing. */
function nonNull(value: string | null): string {
  if (value === null) throw new Error("expected a value but got null");
  return value;
}

function adminActor(id: string): AuthenticatedUser {
  return {
    id,
    email: "admin@example.com",
    role: "administrator",
    partnerId: null,
    permissions: resolvePermissions("administrator"),
  };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("partner creation and approval", () => {
  it("persists a partner and approves it with an audit entry", async () => {
    const admin = await createUser("administrator");
    const created = await partners.create({
      displayName: "Real Trainer",
      category: "personal_trainer",
      email: "trainer@example.com",
      referralCode: "TRAINER001",
    });
    expect(created.status).toBe("pending");

    const approved = await partners.approve(created.id, {
      actor: adminActor(admin.id),
      ip: "203.0.113.9",
      reason: "Documents verified",
    });
    expect(approved.status).toBe("active");

    const entries = await prisma.auditLog.findMany();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: "partner_approved",
      actorUserId: admin.id,
      entityId: created.id,
      ip: "203.0.113.9",
      previousValue: { status: "pending" },
      newValue: { status: "active" },
      reason: "Documents verified",
    });
  });

  it("refuses an illegal transition and writes no audit entry", async () => {
    const admin = await createUser("administrator");
    const partner = await createPartner("deactivated");

    await expect(
      partners.approve(partner.id, { actor: adminActor(admin.id), ip: null, reason: "x" }),
    ).rejects.toThrow();
    expect(await prisma.auditLog.count()).toBe(0);
  });
});

describe("referral creation and attribution", () => {
  it("persists a referral attributed to its partner", async () => {
    const partner = await createPartner();
    const referral = await referrals.create({
      partnerId: partner.id,
      referralCode: partner.referralCode,
      channel: "content",
      customerRef: "cust-123",
    });

    const stored = await prisma.referral.findUniqueOrThrow({ where: { id: referral.id } });
    expect(stored).toMatchObject({
      partnerId: partner.id,
      channel: "content",
      customerRef: "cust-123",
      status: "pending",
    });
  });
});

describe("transaction import, eligibility, and pending commission", () => {
  it("imports an eligible transaction and raises a pending commission", async () => {
    const admin = await createUser("administrator");
    const partner = await createPartner("active");
    await createActivePlan(1000); // 10%
    const referral = await referrals.create({
      partnerId: partner.id,
      referralCode: partner.referralCode,
    });

    const result = await transactions.importManual(
      {
        referralId: referral.id,
        source: "manual",
        externalRef: "order-1",
        amountMinor: 5000,
        currency: "USD",
        occurredAt: new Date().toISOString(),
        settlementStatus: "settled",
      },
      { actor: adminActor(admin.id), ip: null, reason: "Verified order-1" },
    );

    expect(result.ineligibleReasons).toEqual([]);
    expect(result.commissionId).not.toBeNull();

    const commission = await prisma.commission.findUniqueOrThrow({
      where: { id: nonNull(result.commissionId) },
    });
    expect(commission).toMatchObject({
      status: "pending_review",
      commissionAmountMinor: 500,
      approvedById: null,
    });

    const imports = await prisma.auditLog.findMany({
      where: { action: "transaction_imported_manually" },
    });
    expect(imports).toHaveLength(1);
  });

  it("raises no commission for an unsettled transaction", async () => {
    const admin = await createUser("administrator");
    const partner = await createPartner("active");
    await createActivePlan();
    const referral = await referrals.create({
      partnerId: partner.id,
      referralCode: partner.referralCode,
    });

    const result = await transactions.importManual(
      {
        referralId: referral.id,
        source: "manual",
        amountMinor: 5000,
        currency: "USD",
        occurredAt: new Date().toISOString(),
        settlementStatus: "pending",
      },
      { actor: adminActor(admin.id), ip: null, reason: "unsettled" },
    );

    expect(result.ineligibleReasons).toContain("payment_not_settled");
    expect(await prisma.commission.count()).toBe(0);
  });

  it("raises no commission when the partner is suspended", async () => {
    const admin = await createUser("administrator");
    const partner = await createPartner("suspended");
    await createActivePlan();
    const referral = await referrals.create({
      partnerId: partner.id,
      referralCode: partner.referralCode,
    });

    const result = await transactions.importManual(
      {
        referralId: referral.id,
        source: "manual",
        amountMinor: 5000,
        currency: "USD",
        occurredAt: new Date().toISOString(),
        settlementStatus: "settled",
      },
      { actor: adminActor(admin.id), ip: null, reason: "suspended partner" },
    );

    expect(result.ineligibleReasons).toContain("partner_inactive");
    expect(await prisma.commission.count()).toBe(0);
  });
});

describe("commission approval", () => {
  async function seedPendingCommission(): Promise<{ adminId: string; commissionId: string }> {
    const admin = await createUser("administrator");
    const partner = await createPartner("active");
    await createActivePlan(1000);
    const referral = await referrals.create({
      partnerId: partner.id,
      referralCode: partner.referralCode,
    });
    const result = await transactions.importManual(
      {
        referralId: referral.id,
        source: "manual",
        amountMinor: 5000,
        currency: "USD",
        occurredAt: new Date().toISOString(),
        settlementStatus: "settled",
      },
      { actor: adminActor(admin.id), ip: null, reason: "import" },
    );
    return { adminId: admin.id, commissionId: nonNull(result.commissionId) };
  }

  it("approves a commission, audits it, and accrues to the ledger via the event bus", async () => {
    const { adminId, commissionId } = await seedPendingCommission();

    const approved = await commissions.approve(commissionId, {
      actor: adminActor(adminId),
      ip: "198.51.100.10",
      reason: "Order settled and verified",
    });

    expect(approved.status).toBe("approved");
    expect(approved.approvedById).toBe(adminId);
    expect(approved.approvedAt).not.toBeNull();

    const auditEntry = await prisma.auditLog.findFirstOrThrow({
      where: { action: "commission_approved" },
    });
    expect(auditEntry).toMatchObject({
      previousValue: { status: "pending_review" },
      newValue: { status: "approved" },
      reason: "Order settled and verified",
    });

    // The ledger entry is written by the subscriber reacting to the event,
    // not by the commissions service calling the ledger directly.
    const entries = await prisma.ledgerEntry.findMany();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      type: "commission_accrued",
      amountMinor: 500,
      referenceId: commissionId,
    });
  });

  it("refuses to approve an already-rejected commission", async () => {
    const { adminId, commissionId } = await seedPendingCommission();
    await commissions.reject(commissionId, {
      actor: adminActor(adminId),
      ip: null,
      reason: "refunded",
    });

    await expect(
      commissions.approve(commissionId, { actor: adminActor(adminId), ip: null, reason: "retry" }),
    ).rejects.toThrow();

    const stored = await prisma.commission.findUniqueOrThrow({ where: { id: commissionId } });
    expect(stored.status).toBe("rejected");
  });
});

describe("privileged change rolls back when the audit record fails", () => {
  it("leaves the partner untouched if the audit insert violates its foreign key", async () => {
    const partner = await createPartner("pending");
    // A well-formed UUID that is not a real user: the audit insert will fail on
    // the actor foreign key *after* the partner update inside the transaction.
    const ghostAdmin = adminActor(randomUUID());

    await expect(
      partners.approve(partner.id, {
        actor: ghostAdmin,
        ip: null,
        reason: "should never be committed",
      }),
    ).rejects.toThrow();

    const stored = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
    expect(stored.status).toBe("pending");
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("leaves no transaction behind if its import audit fails", async () => {
    const partner = await createPartner("active");
    const referral = await referrals.create({
      partnerId: partner.id,
      referralCode: partner.referralCode,
    });

    await expect(
      transactions.importManual(
        {
          referralId: referral.id,
          source: "manual",
          amountMinor: 1000,
          currency: "USD",
          occurredAt: new Date().toISOString(),
          settlementStatus: "settled",
        },
        { actor: adminActor(randomUUID()), ip: null, reason: "orphan" },
      ),
    ).rejects.toThrow();

    expect(await prisma.transaction.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
  });
});

describe("idempotent ingestion", () => {
  it("treats a re-imported order reference as a replay", async () => {
    const admin = await createUser("administrator");
    const partner = await createPartner("active");
    await createActivePlan(1000);
    const referral = await referrals.create({
      partnerId: partner.id,
      referralCode: partner.referralCode,
    });

    const payload = {
      referralId: referral.id,
      source: "api" as const,
      externalRef: "order-777",
      amountMinor: 5000,
      currency: "USD",
      occurredAt: new Date().toISOString(),
      settlementStatus: "settled" as const,
    };
    const ctx = { actor: adminActor(admin.id), ip: null, reason: "import" };

    const first = await transactions.importManual(payload, ctx);
    const second = await transactions.importManual(payload, ctx);

    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(second.transaction.id).toBe(first.transaction.id);
    expect(second.commissionId).toBe(first.commissionId);

    expect(await prisma.transaction.count()).toBe(1);
    expect(await prisma.commission.count()).toBe(1);
    expect(await prisma.auditLog.count()).toBe(1);
  });

  it("treats a replayed webhook event id as a replay", async () => {
    const admin = await createUser("administrator");
    const partner = await createPartner("active");
    await createActivePlan(1000);
    const referral = await referrals.create({
      partnerId: partner.id,
      referralCode: partner.referralCode,
    });

    const payload = {
      referralId: referral.id,
      source: "webhook" as const,
      amountMinor: 2500,
      currency: "USD",
      occurredAt: new Date().toISOString(),
      settlementStatus: "settled" as const,
    };
    const ctx = { actor: adminActor(admin.id), ip: null, reason: "webhook delivery" };

    const first = await transactions.importManual(payload, ctx, "evt_abc123");
    const second = await transactions.importManual(payload, ctx, "evt_abc123");

    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(second.transaction.id).toBe(first.transaction.id);

    expect(await prisma.transaction.count()).toBe(1);
    expect(await prisma.commission.count()).toBe(1);
    expect(await prisma.ingestedEvent.count()).toBe(1);
  });

  it("still creates distinct transactions for distinct event ids", async () => {
    const admin = await createUser("administrator");
    const partner = await createPartner("active");
    await createActivePlan(1000);
    const referral = await referrals.create({
      partnerId: partner.id,
      referralCode: partner.referralCode,
    });
    const ctx = { actor: adminActor(admin.id), ip: null, reason: "webhook delivery" };
    const payload = {
      referralId: referral.id,
      source: "webhook" as const,
      amountMinor: 2500,
      currency: "USD",
      occurredAt: new Date().toISOString(),
      settlementStatus: "settled" as const,
    };

    await transactions.importManual(payload, ctx, "evt_1");
    await transactions.importManual(payload, ctx, "evt_2");

    expect(await prisma.transaction.count()).toBe(2);
  });
});
