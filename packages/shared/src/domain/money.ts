import { z } from "zod";

/** ISO 4217 alphabetic currency code, e.g. "USD". */
export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO 4217 code");
export type Currency = z.infer<typeof currencySchema>;

/**
 * A monetary amount expressed in the currency's *minor units* (e.g. cents).
 * Money is always an integer to avoid floating-point rounding errors.
 */
export const moneyMinorSchema = z.number().int().nonnegative();

export const moneySchema = z.object({
  amountMinor: moneyMinorSchema,
  currency: currencySchema,
});
export type Money = z.infer<typeof moneySchema>;

/**
 * Computes a commission amount (in minor units) from an eligible amount and a
 * rate expressed in basis points (1% = 100 bps), rounding down.
 *
 * IMPORTANT: the rate is an *input*, deliberately not a business constant.
 * Commission rates are a product decision (see PROJECT.md) supplied by a
 * versioned rule set; they are never hard-coded here.
 */
export function computeCommissionMinor(
  eligibleAmountMinor: number,
  rateBasisPoints: number,
): number {
  if (!Number.isInteger(eligibleAmountMinor) || eligibleAmountMinor < 0) {
    throw new RangeError("eligibleAmountMinor must be a non-negative integer (minor units)");
  }
  if (!Number.isInteger(rateBasisPoints) || rateBasisPoints < 0) {
    throw new RangeError("rateBasisPoints must be a non-negative integer");
  }
  return Math.floor((eligibleAmountMinor * rateBasisPoints) / 10_000);
}
