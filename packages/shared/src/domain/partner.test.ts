import { describe, expect, it } from "vitest";
import {
  createPartnerSchema,
  isPartnerEligibleForCommission,
  PARTNER_CATEGORIES,
  partnerSchema,
  partnerStatusMachine,
  referralCodeSchema,
} from "./partner";

const VALID_UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const NOW = "2026-07-21T12:00:00.000Z";

describe("referralCodeSchema", () => {
  it("accepts 6–20 uppercase alphanumerics", () => {
    expect(referralCodeSchema.safeParse("LAVI2026").success).toBe(true);
  });

  it("rejects lowercase, symbols, or wrong length", () => {
    expect(referralCodeSchema.safeParse("lavi26").success).toBe(false);
    expect(referralCodeSchema.safeParse("ABC").success).toBe(false);
    expect(referralCodeSchema.safeParse("ABC-123").success).toBe(false);
  });
});

describe("createPartnerSchema", () => {
  it("accepts a valid partner across every category", () => {
    for (const category of PARTNER_CATEGORIES) {
      const result = createPartnerSchema.safeParse({
        displayName: "Alex Partner",
        category,
        email: "alex@example.com",
        referralCode: "ALEX2026",
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects an invalid category", () => {
    const result = createPartnerSchema.safeParse({
      displayName: "Alex Partner",
      category: "physician",
      email: "alex@example.com",
      referralCode: "ALEX2026",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = createPartnerSchema.safeParse({
      displayName: "Alex Partner",
      category: "gym",
      email: "not-an-email",
      referralCode: "ALEX2026",
    });
    expect(result.success).toBe(false);
  });
});

describe("partnerSchema", () => {
  it("accepts a fully-formed persisted partner", () => {
    const result = partnerSchema.safeParse({
      id: VALID_UUID,
      displayName: "Alex Partner",
      category: "influencer",
      email: "alex@example.com",
      referralCode: "ALEX2026",
      status: "active",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(result.success).toBe(true);
  });
});

describe("partnerStatusMachine", () => {
  it("permits pending -> active and active -> suspended", () => {
    expect(partnerStatusMachine.canTransition("pending", "active")).toBe(true);
    expect(partnerStatusMachine.canTransition("active", "suspended")).toBe(true);
  });

  it("treats deactivated as terminal", () => {
    expect(partnerStatusMachine.isTerminal("deactivated")).toBe(true);
    expect(partnerStatusMachine.canTransition("deactivated", "active")).toBe(false);
  });
});

describe("isPartnerEligibleForCommission", () => {
  it("is true only for active partners", () => {
    expect(isPartnerEligibleForCommission("active")).toBe(true);
    expect(isPartnerEligibleForCommission("pending")).toBe(false);
    expect(isPartnerEligibleForCommission("suspended")).toBe(false);
    expect(isPartnerEligibleForCommission("deactivated")).toBe(false);
  });
});
