import { describe, expect, it } from "vitest";
import {
  COMMISSION_STATUSES,
  commissionSchema,
  commissionStatusMachine,
  createCommissionSchema,
  isCommissionPayable,
} from "./commission";

const VALID_UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const OTHER_UUID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const ADMIN_UUID = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";
const NOW = "2026-07-21T12:00:00.000Z";

const baseInput = {
  partnerId: VALID_UUID,
  referralId: OTHER_UUID,
  transactionId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  planId: "2c5ea4c0-4067-11e9-8bad-9b1deb4d3b7d",
  planVersion: 1,
  level: 1,
  eligibleAmountMinor: 5000,
  commissionAmountMinor: 500,
  currency: "USD",
};

describe("createCommissionSchema", () => {
  it("accepts a valid commission input", () => {
    expect(createCommissionSchema.safeParse(baseInput).success).toBe(true);
  });

  it("rejects a fractional money amount", () => {
    expect(
      createCommissionSchema.safeParse({ ...baseInput, commissionAmountMinor: 5.5 }).success,
    ).toBe(false);
  });

  it("rejects a missing/invalid plan version", () => {
    expect(createCommissionSchema.safeParse({ ...baseInput, planVersion: 0 }).success).toBe(false);
  });

  it("rejects a non-UUID transaction id", () => {
    expect(createCommissionSchema.safeParse({ ...baseInput, transactionId: "nope" }).success).toBe(
      false,
    );
  });
});

describe("commissionSchema", () => {
  it("defaults approvedBy/approvedAt to null", () => {
    const parsed = commissionSchema.parse({
      ...baseInput,
      id: VALID_UUID,
      status: "pending_review",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(parsed.approvedBy).toBeNull();
    expect(parsed.approvedAt).toBeNull();
  });

  it("accepts an approved commission with approver metadata", () => {
    const result = commissionSchema.safeParse({
      ...baseInput,
      id: VALID_UUID,
      status: "approved",
      approvedBy: ADMIN_UUID,
      approvedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(result.success).toBe(true);
  });
});

describe("commissionStatusMachine", () => {
  it("requires admin review before payment: pending_review -> approved -> paid", () => {
    expect(commissionStatusMachine.canTransition("pending_review", "approved")).toBe(true);
    expect(commissionStatusMachine.canTransition("approved", "paid")).toBe(true);
  });

  it("never pays straight out of review", () => {
    expect(commissionStatusMachine.canTransition("pending_review", "paid")).toBe(false);
  });

  it("allows clawback via reversal from approved and paid", () => {
    expect(commissionStatusMachine.canTransition("approved", "reversed")).toBe(true);
    expect(commissionStatusMachine.canTransition("paid", "reversed")).toBe(true);
  });

  it("treats rejected and reversed as terminal", () => {
    expect(commissionStatusMachine.isTerminal("rejected")).toBe(true);
    expect(commissionStatusMachine.isTerminal("reversed")).toBe(true);
  });

  it("only targets known statuses", () => {
    for (const status of COMMISSION_STATUSES) {
      for (const target of commissionStatusMachine.nextStates(status)) {
        expect(COMMISSION_STATUSES).toContain(target);
      }
    }
  });
});

describe("isCommissionPayable", () => {
  it("is true only for administrator-approved commissions", () => {
    expect(isCommissionPayable("approved")).toBe(true);
    expect(isCommissionPayable("pending_review")).toBe(false);
    expect(isCommissionPayable("rejected")).toBe(false);
    expect(isCommissionPayable("paid")).toBe(false);
    expect(isCommissionPayable("reversed")).toBe(false);
  });
});
