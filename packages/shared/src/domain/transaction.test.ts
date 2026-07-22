import { describe, expect, it } from "vitest";
import {
  createTransactionSchema,
  evaluateTransactionEligibility,
  transactionSchema,
  type TransactionEligibilityInput,
} from "./transaction";

const VALID_UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const NOW = "2026-07-21T12:00:00.000Z";

const eligibleTxn: TransactionEligibilityInput = {
  settlementStatus: "settled",
  refunded: false,
  chargedBack: false,
  cancelled: false,
};

describe("createTransactionSchema", () => {
  it("accepts a valid transaction and defaults settlement/flags", () => {
    const parsed = createTransactionSchema.parse({
      referralId: VALID_UUID,
      source: "manual",
      amountMinor: 5000,
      currency: "USD",
      occurredAt: NOW,
    });
    expect(parsed.settlementStatus).toBe("pending");
    expect(parsed.refunded).toBe(false);
    expect(parsed.chargedBack).toBe(false);
    expect(parsed.cancelled).toBe(false);
  });

  it("rejects an unknown source", () => {
    const result = createTransactionSchema.safeParse({
      referralId: VALID_UUID,
      source: "shopify",
      amountMinor: 5000,
      currency: "USD",
      occurredAt: NOW,
    });
    expect(result.success).toBe(false);
  });
});

describe("transactionSchema", () => {
  it("accepts a fully-formed persisted transaction", () => {
    const result = transactionSchema.safeParse({
      id: VALID_UUID,
      referralId: VALID_UUID,
      source: "csv",
      externalRef: "order-123",
      amountMinor: 5000,
      currency: "USD",
      occurredAt: NOW,
      settlementStatus: "settled",
      refunded: false,
      chargedBack: false,
      cancelled: false,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(result.success).toBe(true);
  });
});

describe("evaluateTransactionEligibility", () => {
  it("is eligible when settled, unflagged, attributed, and partner active", () => {
    const result = evaluateTransactionEligibility(eligibleTxn, {
      partnerActive: true,
      attributionValid: true,
    });
    expect(result).toEqual({ eligible: true, reasons: [] });
  });

  it("collects every failing reason", () => {
    const result = evaluateTransactionEligibility(
      { settlementStatus: "pending", refunded: true, chargedBack: true, cancelled: true },
      { partnerActive: false, attributionValid: false },
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual([
      "payment_not_settled",
      "refunded",
      "charged_back",
      "cancelled",
      "invalid_attribution",
      "partner_inactive",
    ]);
  });

  it("flags an inactive partner even when the transaction is clean", () => {
    const result = evaluateTransactionEligibility(eligibleTxn, {
      partnerActive: false,
      attributionValid: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(["partner_inactive"]);
  });
});
