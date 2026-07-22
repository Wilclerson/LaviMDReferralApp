import { describe, expect, it } from "vitest";
import { referralStatusMachine } from "./referral";
import { createReferralSchema, REFERRAL_STATUSES, referralSchema } from "./referral";

const VALID_UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const OTHER_UUID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const NOW = "2026-07-21T12:00:00.000Z";

describe("createReferralSchema", () => {
  it("accepts a valid payload and defaults the channel to 'link'", () => {
    const parsed = createReferralSchema.parse({
      partnerId: VALID_UUID,
      referralCode: "LAVI2026",
    });
    expect(parsed.channel).toBe("link");
    expect(parsed.customerRef).toBeUndefined();
  });

  it("accepts an explicit channel and opaque customer ref", () => {
    const parsed = createReferralSchema.parse({
      partnerId: VALID_UUID,
      referralCode: "LAVI2026",
      channel: "content",
      customerRef: "cust_abc123",
    });
    expect(parsed.channel).toBe("content");
    expect(parsed.customerRef).toBe("cust_abc123");
  });

  it("rejects a bad referral code", () => {
    const result = createReferralSchema.safeParse({
      partnerId: VALID_UUID,
      referralCode: "nope",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID partner id", () => {
    const result = createReferralSchema.safeParse({
      partnerId: "not-a-uuid",
      referralCode: "LAVI2026",
    });
    expect(result.success).toBe(false);
  });
});

describe("referralSchema", () => {
  it("accepts a fully-formed persisted referral", () => {
    const result = referralSchema.safeParse({
      id: OTHER_UUID,
      partnerId: VALID_UUID,
      referralCode: "LAVI2026",
      channel: "link",
      status: "signed_up",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(result.success).toBe(true);
  });
});

describe("referralStatusMachine", () => {
  it("permits the acquisition funnel: pending -> signed_up -> converted", () => {
    expect(referralStatusMachine.canTransition("pending", "signed_up")).toBe(true);
    expect(referralStatusMachine.canTransition("signed_up", "converted")).toBe(true);
  });

  it("allows a converted referral to be cancelled (e.g. fraud reversal)", () => {
    expect(referralStatusMachine.canTransition("converted", "cancelled")).toBe(true);
  });

  it("forbids skipping straight from pending to converted", () => {
    expect(referralStatusMachine.canTransition("pending", "converted")).toBe(false);
  });

  it("treats expired and cancelled as terminal", () => {
    expect(referralStatusMachine.isTerminal("expired")).toBe(true);
    expect(referralStatusMachine.isTerminal("cancelled")).toBe(true);
  });

  it("only targets known statuses", () => {
    for (const status of REFERRAL_STATUSES) {
      for (const target of referralStatusMachine.nextStates(status)) {
        expect(REFERRAL_STATUSES).toContain(target);
      }
    }
  });
});
