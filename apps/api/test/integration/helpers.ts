import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../src/prisma/prisma.service";

export const prisma = new PrismaClient();

/** Lets services that expect a PrismaService accept the raw test client. */
export const prismaAsService = prisma as unknown as PrismaService;

const TABLES = [
  "AuditLog",
  "LedgerEntry",
  "Commission",
  "IngestedEvent",
  "Transaction",
  "CommissionRule",
  "CommissionPlan",
  "Referral",
  "ConsentRecord",
  "PermissionGrant",
  "User",
  "Partner",
];

export async function resetDatabase(): Promise<void> {
  const list = TABLES.map((table) => `"public"."${table}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function createUser(
  role: "super_admin" | "administrator" | "partner" | "customer",
  partnerId?: string,
): Promise<{ id: string; email: string }> {
  const email = `${role}-${randomUUID()}@example.com`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hash("integration-test-password", 4),
      role,
      partnerId: partnerId ?? null,
    },
  });
  return { id: user.id, email: user.email };
}

export async function createPartner(
  status: "pending" | "active" | "suspended" | "deactivated" = "active",
): Promise<{ id: string; referralCode: string }> {
  const referralCode = `P${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  const partner = await prisma.partner.create({
    data: {
      displayName: "Integration Partner",
      category: "personal_trainer",
      email: `partner-${randomUUID()}@example.com`,
      referralCode,
      status,
    },
  });
  return { id: partner.id, referralCode: partner.referralCode };
}

export async function createActivePlan(rateBasisPoints = 1000): Promise<{ id: string }> {
  const plan = await prisma.commissionPlan.create({
    data: {
      planKey: randomUUID(),
      version: 1,
      name: "Integration Plan",
      status: "active",
      currency: "USD",
      levels: { create: [{ level: 1, calcType: "percentage", rateBasisPoints }] },
    },
  });
  return { id: plan.id };
}

/** Fetches a single scalar from a raw query — used for schema introspection. */
export async function queryRows<T>(sql: string): Promise<T[]> {
  return prisma.$queryRawUnsafe<T[]>(sql);
}
