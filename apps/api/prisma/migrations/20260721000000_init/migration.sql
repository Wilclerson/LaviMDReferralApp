-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('super_admin', 'administrator', 'partner', 'customer');

-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('allow', 'deny');

-- CreateEnum
CREATE TYPE "PartnerCategory" AS ENUM ('personal_trainer', 'hairstylist', 'esthetician', 'barber', 'wellness_coach', 'massage_therapist', 'chiropractor', 'gym', 'influencer');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('pending', 'active', 'suspended', 'deactivated');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('pending', 'signed_up', 'converted', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "ReferralChannel" AS ENUM ('link', 'code', 'content', 'invite');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('manual', 'csv', 'api', 'webhook');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('pending', 'settled', 'failed');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('pending_review', 'approved', 'rejected', 'paid', 'reversed');

-- CreateEnum
CREATE TYPE "CommissionCalcType" AS ENUM ('percentage', 'flat', 'hybrid');

-- CreateEnum
CREATE TYPE "CommissionPlanStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('commission_accrued', 'commission_reversed', 'payout');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('partner_approved', 'partner_suspended', 'commission_approved', 'commission_rejected', 'commission_reversed', 'payout_created', 'payout_approved', 'payout_cancelled', 'commission_plan_changed', 'role_changed', 'permission_changed', 'attribution_overridden', 'transaction_imported_manually');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "partnerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionGrant" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "permission" TEXT NOT NULL,
    "effect" "PermissionEffect" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" "PartnerCategory" NOT NULL,
    "email" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "status" "PartnerStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "referralCode" TEXT NOT NULL,
    "channel" "ReferralChannel" NOT NULL DEFAULT 'link',
    "customerRef" TEXT,
    "status" "ReferralStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "referralId" UUID NOT NULL,
    "source" "TransactionSource" NOT NULL,
    "externalRef" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "settlementStatus" "SettlementStatus" NOT NULL DEFAULT 'pending',
    "refunded" BOOLEAN NOT NULL DEFAULT false,
    "chargedBack" BOOLEAN NOT NULL DEFAULT false,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPlan" (
    "id" UUID NOT NULL,
    "planKey" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CommissionPlanStatus" NOT NULL DEFAULT 'draft',
    "currency" CHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "calcType" "CommissionCalcType" NOT NULL,
    "rateBasisPoints" INTEGER,
    "flatAmountMinor" INTEGER,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "referralId" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "planVersion" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "eligibleAmountMinor" INTEGER NOT NULL,
    "commissionAmountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'pending_review',
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" UUID NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "partnerId" UUID NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "referenceId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actorUserId" UUID NOT NULL,
    "actorRole" "Role" NOT NULL,
    "ip" VARCHAR(45),
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_partnerId_key" ON "User"("partnerId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "PermissionGrant_userId_idx" ON "PermissionGrant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionGrant_userId_permission_key" ON "PermissionGrant"("userId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_email_key" ON "Partner"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_referralCode_key" ON "Partner"("referralCode");

-- CreateIndex
CREATE INDEX "Partner_status_idx" ON "Partner"("status");

-- CreateIndex
CREATE INDEX "Partner_category_idx" ON "Partner"("category");

-- CreateIndex
CREATE INDEX "Referral_partnerId_idx" ON "Referral"("partnerId");

-- CreateIndex
CREATE INDEX "Referral_customerRef_idx" ON "Referral"("customerRef");

-- CreateIndex
CREATE INDEX "Referral_status_idx" ON "Referral"("status");

-- CreateIndex
CREATE INDEX "Referral_createdAt_idx" ON "Referral"("createdAt");

-- CreateIndex
CREATE INDEX "Transaction_referralId_idx" ON "Transaction"("referralId");

-- CreateIndex
CREATE INDEX "Transaction_occurredAt_idx" ON "Transaction"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_source_externalRef_key" ON "Transaction"("source", "externalRef");

-- CreateIndex
CREATE INDEX "CommissionPlan_status_idx" ON "CommissionPlan"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionPlan_planKey_version_key" ON "CommissionPlan"("planKey", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionRule_planId_level_key" ON "CommissionRule"("planId", "level");

-- CreateIndex
CREATE INDEX "Commission_partnerId_idx" ON "Commission"("partnerId");

-- CreateIndex
CREATE INDEX "Commission_status_idx" ON "Commission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_transactionId_level_key" ON "Commission"("transactionId", "level");

-- CreateIndex
CREATE INDEX "LedgerEntry_partnerId_idx" ON "LedgerEntry"("partnerId");

-- CreateIndex
CREATE INDEX "LedgerEntry_referenceId_idx" ON "LedgerEntry"("referenceId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_occurredAt_idx" ON "AuditLog"("occurredAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGrant" ADD CONSTRAINT "PermissionGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CommissionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CommissionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

