import type { RegisterCustomerInput } from "@lavimd/shared";
import { ForbiddenException } from "@nestjs/common";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "../../src/audit/audit.service";
import { AuthContextService } from "../../src/auth/auth-context.service";
import { CommissionsService } from "../../src/commissions/commissions.service";
import { InMemoryEventBus } from "../../src/common/events/event-bus";
import { CustomersService } from "../../src/customers/customers.service";
import { HealthController } from "../../src/health/health.controller";
import { ReferralsService } from "../../src/referrals/referrals.service";
import { createPartner, createUser, prisma, prismaAsService, resetDatabase } from "./helpers";

const bus = new InMemoryEventBus();
const authContext = new AuthContextService(prismaAsService);
const referrals = new ReferralsService(prismaAsService, bus);
const commissions = new CommissionsService(prismaAsService, new AuditService(prismaAsService), bus);
const customers = new CustomersService(prismaAsService);

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("permission overrides (stored in the database)", () => {
  it("resolves role defaults when no overrides exist", async () => {
    const admin = await createUser("administrator");
    const actor = await authContext.buildUser(admin.id);

    expect(actor.permissions.has("commission.approve")).toBe(true);
    expect(actor.permissions.has("financial_report.view_operational")).toBe(true);
    expect(actor.permissions.has("financial_report.view_all")).toBe(false);
    expect(actor.permissions.has("system.audit_log.view")).toBe(false);
  });

  it("grants an extra permission from a stored allow override", async () => {
    const admin = await createUser("administrator");
    await prisma.permissionGrant.create({
      data: { userId: admin.id, permission: "system.audit_log.view", effect: "allow" },
    });

    const actor = await authContext.buildUser(admin.id);
    expect(actor.permissions.has("system.audit_log.view")).toBe(true);
  });

  it("revokes a default permission from a stored deny override", async () => {
    const admin = await createUser("administrator");
    await prisma.permissionGrant.create({
      data: { userId: admin.id, permission: "commission.approve", effect: "deny" },
    });

    const actor = await authContext.buildUser(admin.id);
    expect(actor.permissions.has("commission.approve")).toBe(false);
  });

  it("lets a deny override beat an allow for the same permission", async () => {
    const partner = await createPartner();
    const user = await createUser("partner", partner.id);
    await prisma.permissionGrant.create({
      data: { userId: user.id, permission: "referral.view_any", effect: "deny" },
    });

    const actor = await authContext.buildUser(user.id);
    expect(actor.permissions.has("referral.view_any")).toBe(false);
  });

  it("ignores a stored grant that is no longer a known permission", async () => {
    const admin = await createUser("administrator");
    await prisma.permissionGrant.create({
      data: { userId: admin.id, permission: "legacy.permission", effect: "allow" },
    });

    const actor = await authContext.buildUser(admin.id);
    expect(actor.permissions.has("commission.approve")).toBe(true);
  });

  it("refuses to build a principal for a deactivated user", async () => {
    const admin = await createUser("administrator");
    await prisma.user.update({ where: { id: admin.id }, data: { isActive: false } });

    await expect(authContext.buildUser(admin.id)).rejects.toThrow();
  });
});

describe("partner-owned resource isolation", () => {
  it("returns only the partner's own referrals and hides other partners'", async () => {
    const partnerA = await createPartner();
    const partnerB = await createPartner();
    const userA = await createUser("partner", partnerA.id);

    const mine = await referrals.create({
      partnerId: partnerA.id,
      referralCode: partnerA.referralCode,
    });
    const theirs = await referrals.create({
      partnerId: partnerB.id,
      referralCode: partnerB.referralCode,
    });

    const actor = await authContext.buildUser(userA.id);
    const list = await referrals.listForActor(actor);

    expect(list.total).toBe(1);
    expect(list.items.map((item) => item.id)).toEqual([mine.id]);

    await expect(referrals.findByIdForActor(theirs.id, actor)).rejects.toThrow(ForbiddenException);
    await expect(referrals.findByIdForActor(mine.id, actor)).resolves.toMatchObject({
      id: mine.id,
    });
  });

  it("hides another partner's commissions", async () => {
    const partnerA = await createPartner();
    const partnerB = await createPartner();
    const userA = await createUser("partner", partnerA.id);
    const plan = await prisma.commissionPlan.create({
      data: { planKey: crypto.randomUUID(), version: 1, name: "P", currency: "USD" },
    });

    const makeCommission = async (partnerId: string): Promise<string> => {
      const referral = await prisma.referral.create({
        data: { partnerId, referralCode: "CODE123456" },
      });
      const transaction = await prisma.transaction.create({
        data: {
          referralId: referral.id,
          source: "manual",
          amountMinor: 1000,
          currency: "USD",
          occurredAt: new Date(),
        },
      });
      const commission = await prisma.commission.create({
        data: {
          partnerId,
          referralId: referral.id,
          transactionId: transaction.id,
          planId: plan.id,
          planVersion: 1,
          level: 1,
          eligibleAmountMinor: 1000,
          commissionAmountMinor: 100,
          currency: "USD",
        },
      });
      return commission.id;
    };

    const mine = await makeCommission(partnerA.id);
    const theirs = await makeCommission(partnerB.id);

    const actor = await authContext.buildUser(userA.id);
    const list = await commissions.listForActor(actor);

    expect(list.total).toBe(1);
    expect(list.items.map((item) => item.id)).toEqual([mine]);
    await expect(commissions.findByIdForActor(theirs, actor)).rejects.toThrow(ForbiddenException);
  });

  it("shows a partner user with no linked partner record nothing at all", async () => {
    const partner = await createPartner();
    const orphan = await createUser("partner");
    await referrals.create({ partnerId: partner.id, referralCode: partner.referralCode });

    const actor = await authContext.buildUser(orphan.id);
    await expect(referrals.listForActor(actor)).resolves.toMatchObject({ total: 0 });
  });

  it("lets an administrator see every partner's referrals", async () => {
    const partnerA = await createPartner();
    const partnerB = await createPartner();
    const admin = await createUser("administrator");
    await referrals.create({ partnerId: partnerA.id, referralCode: partnerA.referralCode });
    await referrals.create({ partnerId: partnerB.id, referralCode: partnerB.referralCode });

    const actor = await authContext.buildUser(admin.id);
    await expect(referrals.listForActor(actor)).resolves.toMatchObject({ total: 2 });
  });
});

describe("customer registration (public, with consent capture)", () => {
  const payload: RegisterCustomerInput = {
    email: "New.Customer@Example.com",
    password: "a-sufficiently-long-passphrase",
    consent: { version: "2026-07-01", terms: true, privacy: true, marketing: true },
  };

  it("creates a customer with normalized email and three consent records", async () => {
    const result = await customers.register(payload, { ip: "203.0.113.5", userAgent: "vitest" });
    expect(result.created).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "new.customer@example.com" },
    });
    expect(user.role).toBe("customer");

    const consents = await prisma.consentRecord.findMany({ where: { userId: user.id } });
    expect(consents).toHaveLength(3);
    expect(consents.every((record) => record.ip === "203.0.113.5")).toBe(true);
    expect(consents.find((record) => record.type === "marketing")?.granted).toBe(true);
  });

  it("stores marketing consent as false when not opted in", async () => {
    await customers.register(
      {
        ...payload,
        email: "optout@example.com",
        consent: { version: "v1", terms: true, privacy: true },
      },
      { ip: null, userAgent: null },
    );

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "optout@example.com" } });
    const marketing = await prisma.consentRecord.findFirstOrThrow({
      where: { userId: user.id, type: "marketing" },
    });
    expect(marketing.granted).toBe(false);
  });

  it("does not create a second account for an existing email", async () => {
    await customers.register(payload, { ip: null, userAgent: null });
    const result = await customers.register(payload, { ip: null, userAgent: null });

    expect(result.created).toBe(false);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.consentRecord.count()).toBe(3);
  });

  it("rejects registration without the required consent", async () => {
    // The schema types terms/privacy as literal `true`, so an un-consented
    // payload can only arrive from an untyped caller — which is what we simulate.
    const withoutConsent = {
      ...payload,
      consent: { version: "v1", terms: false, privacy: true },
    } as unknown as RegisterCustomerInput;

    await expect(
      customers.register(withoutConsent, { ip: null, userAgent: null }),
    ).rejects.toThrow();
    expect(await prisma.user.count()).toBe(0);
  });
});

describe("health probes against a real database", () => {
  it("reports live and ready while PostgreSQL is available", async () => {
    const controller = new HealthController(prismaAsService);
    expect(controller.live()).toEqual({ status: "ok" });
    await expect(controller.ready()).resolves.toEqual({ status: "ok" });
  });

  it("reports unavailable when the database cannot be reached", async () => {
    const { PrismaClient } = await import("@prisma/client");
    // Point at a port with nothing listening — a real connection failure.
    const unreachable = new PrismaClient({
      datasources: { db: { url: "postgresql://postgres:postgres@localhost:1/none" } },
    });
    const controller = new HealthController(unreachable as never);

    await expect(controller.ready()).rejects.toThrow(/Database not reachable/);
    // Liveness must stay green: the process is healthy even if a dependency is not.
    expect(controller.live()).toEqual({ status: "ok" });

    await unreachable.$disconnect();
  });
});
