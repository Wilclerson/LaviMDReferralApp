import { describe, expect, it } from "vitest";
import {
  createPayoutSchema,
  DEFAULT_MINIMUM_PAYOUT_BALANCE_MINOR,
  meetsMinimumPayout,
  payoutSchema,
  payoutStatusMachine,
} from "./payout";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const ADMIN = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";
const NOW = "2026-07-21T12:00:00.000Z";
const PERIOD_START = "2026-07-01T00:00:00.000Z";

const baseInput = {
  partnerId: UUID,
  method: "ach",
  amountMinor: 12_000,
  currency: "USD",
  periodStart: PERIOD_START,
  periodEnd: NOW,
};

describe("createPayoutSchema", () => {
  it("accepts each supported method", () => {
    for (const method of ["ach", "paypal", "manual"]) {
      expect(createPayoutSchema.safeParse({ ...baseInput, method }).success).toBe(true);
    }
  });

  it("rejects an unsupported method", () => {
    expect(createPayoutSchema.safeParse({ ...baseInput, method: "wire" }).success).toBe(false);
  });
});

describe("payoutSchema", () => {
  it("defaults approver metadata to null", () => {
    const parsed = payoutSchema.parse({
      ...baseInput,
      id: UUID,
      status: "pending_approval",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(parsed.approvedBy).toBeNull();
    expect(parsed.approvedAt).toBeNull();
  });

  it("accepts an approved payout with approver metadata", () => {
    const result = payoutSchema.safeParse({
      ...baseInput,
      id: UUID,
      status: "approved",
      approvedBy: ADMIN,
      approvedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(result.success).toBe(true);
  });
});

describe("payoutStatusMachine", () => {
  it("requires approval before completion", () => {
    expect(payoutStatusMachine.canTransition("pending_approval", "approved")).toBe(true);
    expect(payoutStatusMachine.canTransition("approved", "completed")).toBe(true);
    expect(payoutStatusMachine.canTransition("pending_approval", "completed")).toBe(false);
  });

  it("treats completed, failed, and cancelled as terminal", () => {
    expect(payoutStatusMachine.isTerminal("completed")).toBe(true);
    expect(payoutStatusMachine.isTerminal("failed")).toBe(true);
    expect(payoutStatusMachine.isTerminal("cancelled")).toBe(true);
  });
});

describe("meetsMinimumPayout", () => {
  it("uses the $50 default minimum", () => {
    expect(DEFAULT_MINIMUM_PAYOUT_BALANCE_MINOR).toBe(5000);
    expect(meetsMinimumPayout(4999)).toBe(false);
    expect(meetsMinimumPayout(5000)).toBe(true);
  });

  it("accepts a custom minimum", () => {
    expect(meetsMinimumPayout(1000, 2000)).toBe(false);
    expect(meetsMinimumPayout(2000, 2000)).toBe(true);
  });
});
