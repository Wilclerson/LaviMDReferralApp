import { describe, expect, it } from "vitest";
import { ledgerEntrySchema, sumLedgerBalanceMinor, type LedgerEntry } from "./ledger";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const NOW = "2026-07-21T12:00:00.000Z";

const entry = (type: LedgerEntry["type"], amountMinor: number): LedgerEntry => ({
  id: UUID,
  type,
  partnerId: UUID,
  amountMinor,
  currency: "USD",
  referenceId: "ref-1",
  occurredAt: NOW,
});

describe("ledgerEntrySchema", () => {
  it("accepts a positive accrual and a negative payout", () => {
    expect(ledgerEntrySchema.safeParse(entry("commission_accrued", 500)).success).toBe(true);
    expect(ledgerEntrySchema.safeParse(entry("payout", -12_000)).success).toBe(true);
  });

  it("rejects a fractional amount", () => {
    expect(ledgerEntrySchema.safeParse(entry("commission_accrued", 5.5)).success).toBe(false);
  });

  it("rejects an unknown entry type", () => {
    expect(
      ledgerEntrySchema.safeParse({ ...entry("commission_accrued", 500), type: "bonus" }).success,
    ).toBe(false);
  });
});

describe("sumLedgerBalanceMinor", () => {
  it("sums signed amounts to a running balance", () => {
    const balance = sumLedgerBalanceMinor([
      entry("commission_accrued", 500),
      entry("commission_accrued", 300),
      entry("commission_reversed", -100),
      entry("payout", -600),
    ]);
    expect(balance).toBe(100);
  });

  it("returns 0 for an empty ledger", () => {
    expect(sumLedgerBalanceMinor([])).toBe(0);
  });
});
