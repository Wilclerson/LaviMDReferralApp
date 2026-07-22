import { describe, expect, it } from "vitest";
import { computeCommissionMinor, currencySchema, moneySchema } from "./money";

describe("currencySchema", () => {
  it("accepts an ISO 4217 code", () => {
    expect(currencySchema.safeParse("USD").success).toBe(true);
  });

  it("rejects lowercase or wrong-length codes", () => {
    expect(currencySchema.safeParse("usd").success).toBe(false);
    expect(currencySchema.safeParse("US").success).toBe(false);
  });
});

describe("moneySchema", () => {
  it("accepts a non-negative integer amount with a currency", () => {
    expect(moneySchema.safeParse({ amountMinor: 1500, currency: "USD" }).success).toBe(true);
  });

  it("rejects fractional or negative amounts", () => {
    expect(moneySchema.safeParse({ amountMinor: 10.5, currency: "USD" }).success).toBe(false);
    expect(moneySchema.safeParse({ amountMinor: -1, currency: "USD" }).success).toBe(false);
  });
});

describe("computeCommissionMinor", () => {
  it("computes a basis-point rate and rounds down", () => {
    // 10% of $50.00 (5000 minor) = 500 minor
    expect(computeCommissionMinor(5000, 1000)).toBe(500);
    // 2.5% of 199 minor = 4.975 -> 4
    expect(computeCommissionMinor(199, 250)).toBe(4);
  });

  it("returns 0 for a 0% rate or 0 amount", () => {
    expect(computeCommissionMinor(5000, 0)).toBe(0);
    expect(computeCommissionMinor(0, 1000)).toBe(0);
  });

  it("throws on a non-integer or negative eligible amount", () => {
    expect(() => computeCommissionMinor(10.5, 1000)).toThrow(RangeError);
    expect(() => computeCommissionMinor(-1, 1000)).toThrow(RangeError);
  });

  it("throws on a non-integer or negative rate", () => {
    expect(() => computeCommissionMinor(5000, 12.5)).toThrow(RangeError);
    expect(() => computeCommissionMinor(5000, -100)).toThrow(RangeError);
  });
});
