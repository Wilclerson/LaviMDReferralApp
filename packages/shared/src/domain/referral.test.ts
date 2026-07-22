import { describe, expect, it } from "vitest";
import {
  ALLOWED_TRANSITIONS,
  canTransitionReferral,
  createReferralSchema,
  isTerminalReferralStatus,
  REFERRAL_STATUSES,
  referralSchema,
} from "./referral";

const VALID_UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const OTHER_UUID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const NOW = "2026-07-21T12:00:00.000Z";

describe("createReferralSchema", () => {
  it("accepts a valid payload and applies the default priority", () => {
    const parsed = createReferralSchema.parse({
      patientRef: "patient-abc",
      referringProviderId: VALID_UUID,
      specialty: "Cardiology",
      reason: "Chest pain workup",
    });

    expect(parsed.priority).toBe("routine");
    expect(parsed.receivingProviderId).toBeUndefined();
  });

  it("rejects a non-UUID referring provider id", () => {
    const result = createReferralSchema.safeParse({
      patientRef: "patient-abc",
      referringProviderId: "not-a-uuid",
      specialty: "Cardiology",
      reason: "Chest pain workup",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an empty reason", () => {
    const result = createReferralSchema.safeParse({
      patientRef: "patient-abc",
      referringProviderId: VALID_UUID,
      specialty: "Cardiology",
      reason: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("referralSchema", () => {
  it("accepts a fully-formed persisted referral", () => {
    const result = referralSchema.safeParse({
      id: OTHER_UUID,
      patientRef: "patient-abc",
      referringProviderId: VALID_UUID,
      specialty: "Cardiology",
      reason: "Chest pain workup",
      priority: "urgent",
      status: "submitted",
      createdAt: NOW,
      updatedAt: NOW,
    });

    expect(result.success).toBe(true);
  });
});

describe("canTransitionReferral", () => {
  it("permits draft -> submitted", () => {
    expect(canTransitionReferral("draft", "submitted")).toBe(true);
  });

  it("forbids completed -> submitted", () => {
    expect(canTransitionReferral("completed", "submitted")).toBe(false);
  });

  it("keeps every declared target within the known status set", () => {
    for (const [, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
      for (const target of targets) {
        expect(REFERRAL_STATUSES).toContain(target);
      }
    }
  });
});

describe("isTerminalReferralStatus", () => {
  it("treats completed, declined, and cancelled as terminal", () => {
    expect(isTerminalReferralStatus("completed")).toBe(true);
    expect(isTerminalReferralStatus("declined")).toBe(true);
    expect(isTerminalReferralStatus("cancelled")).toBe(true);
  });

  it("treats draft as non-terminal", () => {
    expect(isTerminalReferralStatus("draft")).toBe(false);
  });
});
