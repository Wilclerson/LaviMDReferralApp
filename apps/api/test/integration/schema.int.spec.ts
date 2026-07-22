import { afterAll, describe, expect, it } from "vitest";
import { createPartner, createUser, prisma, queryRows, resetDatabase } from "./helpers";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("schema: tables", () => {
  it("creates every expected table", async () => {
    const rows = await queryRows<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    );
    const tables = rows.map((row) => row.table_name);

    for (const expected of [
      "User",
      "PermissionGrant",
      "ConsentRecord",
      "Partner",
      "Referral",
      "Transaction",
      "IngestedEvent",
      "CommissionPlan",
      "CommissionRule",
      "Commission",
      "LedgerEntry",
      "AuditLog",
    ]) {
      expect(tables).toContain(expected);
    }
  });
});

describe("schema: enums", () => {
  it("creates each enum with exactly the expected values", async () => {
    const rows = await queryRows<{ enum_name: string; value: string }>(
      `SELECT t.typname AS enum_name, e.enumlabel AS value
       FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
       JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public'
       ORDER BY t.typname, e.enumsortorder`,
    );

    const byEnum = new Map<string, string[]>();
    for (const row of rows) {
      byEnum.set(row.enum_name, [...(byEnum.get(row.enum_name) ?? []), row.value]);
    }

    expect(byEnum.get("Role")).toEqual(["super_admin", "administrator", "partner", "customer"]);
    expect(byEnum.get("CommissionStatus")).toEqual([
      "pending_review",
      "approved",
      "rejected",
      "paid",
      "reversed",
    ]);
    expect(byEnum.get("PartnerCategory")).toHaveLength(9);
    expect(byEnum.get("AuditAction")).toHaveLength(13);
    expect(byEnum.get("ConsentType")).toEqual(["terms", "privacy", "marketing"]);
    expect(byEnum.get("LedgerEntryType")).toEqual([
      "commission_accrued",
      "commission_reversed",
      "payout",
    ]);
  });
});

describe("schema: unique constraints", () => {
  it("enforces unique partner referral codes and emails", async () => {
    await resetDatabase();
    const partner = await createPartner();

    await expect(
      prisma.partner.create({
        data: {
          displayName: "Duplicate",
          category: "gym",
          email: "unique-dup@example.com",
          referralCode: partner.referralCode,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("enforces unique user emails", async () => {
    await resetDatabase();
    const user = await createUser("administrator");

    await expect(
      prisma.user.create({ data: { email: user.email, passwordHash: "x", role: "administrator" } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("enforces one commission per transaction level", async () => {
    await resetDatabase();
    const partner = await createPartner();
    const referral = await prisma.referral.create({
      data: { partnerId: partner.id, referralCode: partner.referralCode },
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
    const plan = await prisma.commissionPlan.create({
      data: { planKey: crypto.randomUUID(), version: 1, name: "P", currency: "USD" },
    });

    const base = {
      partnerId: partner.id,
      referralId: referral.id,
      transactionId: transaction.id,
      planId: plan.id,
      planVersion: 1,
      level: 1,
      eligibleAmountMinor: 1000,
      commissionAmountMinor: 100,
      currency: "USD",
    };
    await prisma.commission.create({ data: base });

    await expect(prisma.commission.create({ data: base })).rejects.toMatchObject({ code: "P2002" });
  });

  it("enforces one ingested event per (source, externalEventId)", async () => {
    await resetDatabase();
    await prisma.ingestedEvent.create({ data: { source: "webhook", externalEventId: "evt_1" } });

    await expect(
      prisma.ingestedEvent.create({ data: { source: "webhook", externalEventId: "evt_1" } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("allows repeated NULL externalRef on transactions", async () => {
    await resetDatabase();
    const partner = await createPartner();
    const referral = await prisma.referral.create({
      data: { partnerId: partner.id, referralCode: partner.referralCode },
    });
    const data = {
      referralId: referral.id,
      source: "manual" as const,
      amountMinor: 500,
      currency: "USD",
      occurredAt: new Date(),
    };

    await prisma.transaction.create({ data });
    await expect(prisma.transaction.create({ data })).resolves.toBeDefined();
  });
});

describe("schema: foreign keys and cascade behaviour", () => {
  it("rejects a referral pointing at a non-existent partner", async () => {
    await resetDatabase();
    await expect(
      prisma.referral.create({
        data: { partnerId: crypto.randomUUID(), referralCode: "NOPE123456" },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("restricts deleting a partner that still has referrals", async () => {
    await resetDatabase();
    const partner = await createPartner();
    await prisma.referral.create({
      data: { partnerId: partner.id, referralCode: partner.referralCode },
    });

    // PostgreSQL raises 23001 (restrict_violation) for ON DELETE RESTRICT,
    // which Prisma surfaces as an unknown request error rather than P2003.
    await expect(prisma.partner.delete({ where: { id: partner.id } })).rejects.toThrow(
      /RESTRICT setting of foreign key constraint.*Referral_partnerId_fkey/,
    );
  });

  it("cascades permission grants and consent records when a user is deleted", async () => {
    await resetDatabase();
    const user = await createUser("administrator");
    await prisma.permissionGrant.create({
      data: { userId: user.id, permission: "system.audit_log.view", effect: "allow" },
    });
    await prisma.consentRecord.create({
      data: { userId: user.id, type: "terms", granted: true, version: "v1" },
    });

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.permissionGrant.count()).toBe(0);
    expect(await prisma.consentRecord.count()).toBe(0);
  });

  it("restricts deleting a user that owns audit entries", async () => {
    await resetDatabase();
    const user = await createUser("administrator");
    await prisma.auditLog.create({
      data: {
        action: "partner_approved",
        actorUserId: user.id,
        actorRole: "administrator",
        entityType: "partner",
        entityId: crypto.randomUUID(),
        reason: "keeps the trail intact",
      },
    });

    // The audit trail outlives the account: a user with audit entries cannot be
    // deleted, so history can never be erased by removing its author.
    await expect(prisma.user.delete({ where: { id: user.id } })).rejects.toThrow(
      /RESTRICT setting of foreign key constraint.*AuditLog_actorUserId_fkey/,
    );
  });

  it("nulls a partner link when the partner row is removed", async () => {
    await resetDatabase();
    const partner = await createPartner();
    const user = await createUser("partner", partner.id);

    await prisma.partner.delete({ where: { id: partner.id } });

    const reloaded = await prisma.user.findUnique({ where: { id: user.id } });
    expect(reloaded?.partnerId).toBeNull();
  });
});

describe("schema: indexes", () => {
  it("indexes the columns used for filtering and joins", async () => {
    const rows = await queryRows<{ tablename: string; indexdef: string }>(
      `SELECT tablename, indexdef FROM pg_indexes WHERE schemaname = 'public'`,
    );
    /**
     * Extracts the indexed column names. PostgreSQL only quotes identifiers
     * that need it, so `"partnerId"` is quoted but `status` is not.
     */
    const indexedColumns = (indexdef: string): string[] => {
      const columnList = /\(([^)]*)\)\s*$/.exec(indexdef)?.[1];
      if (columnList === undefined) return [];
      return columnList
        .split(",")
        .map((entry) => entry.trim().replace(/^"|"$/g, "").split(" ")[0] ?? "");
    };

    const hasIndexOn = (table: string, column: string): boolean =>
      rows.some((row) => row.tablename === table && indexedColumns(row.indexdef).includes(column));

    const required: [string, string][] = [
      ["Referral", "partnerId"],
      ["Referral", "customerRef"],
      ["Referral", "status"],
      ["Transaction", "referralId"],
      ["Transaction", "occurredAt"],
      ["Commission", "partnerId"],
      ["Commission", "status"],
      ["LedgerEntry", "partnerId"],
      ["LedgerEntry", "referenceId"],
      ["AuditLog", "actorUserId"],
      ["AuditLog", "occurredAt"],
      ["AuditLog", "action"],
      ["ConsentRecord", "userId"],
      ["PermissionGrant", "userId"],
    ];

    // Report every missing index at once rather than failing on the first.
    const missing = required.filter(([table, column]) => !hasIndexOn(table, column));
    expect(missing).toEqual([]);
  });
});
