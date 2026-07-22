import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";

/**
 * Development seed data.
 *
 * Commission rates here are seed *data* (an administrator-configurable plan),
 * not business logic — nothing in the code hard-codes a percentage.
 */
const prisma = new PrismaClient();

const PASSWORD_ROUNDS = 12;

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed a production database");
  }

  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? "superadmin@example.com";
  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";

  const superAdminHash = await hash(superAdminPassword, PASSWORD_ROUNDS);
  const adminHash = await hash("ChangeMe123!", PASSWORD_ROUNDS);
  const partnerHash = await hash("ChangeMe123!", PASSWORD_ROUNDS);

  await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: { email: superAdminEmail, passwordHash: superAdminHash, role: "super_admin" },
  });

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: { email: "admin@example.com", passwordHash: adminHash, role: "administrator" },
  });

  const partner = await prisma.partner.upsert({
    where: { email: "partner@example.com" },
    update: {},
    create: {
      displayName: "Sample Personal Trainer",
      category: "personal_trainer",
      email: "partner@example.com",
      referralCode: "LAVI2026",
      status: "active",
    },
  });

  await prisma.user.upsert({
    where: { email: "partner@example.com" },
    update: {},
    create: {
      email: "partner@example.com",
      passwordHash: partnerHash,
      role: "partner",
      partnerId: partner.id,
    },
  });

  const planKey = randomUUID();
  const existingPlan = await prisma.commissionPlan.findFirst({ where: { name: "Standard" } });
  if (existingPlan === null) {
    await prisma.commissionPlan.create({
      data: {
        planKey,
        version: 1,
        name: "Standard",
        status: "active",
        currency: "USD",
        levels: {
          create: [
            { level: 1, calcType: "percentage", rateBasisPoints: 1000 }, // 10%
            { level: 2, calcType: "percentage", rateBasisPoints: 300 }, // 3%
          ],
        },
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
