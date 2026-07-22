import { z } from "zod";
import { createStatusMachine } from "../utils/state-machine";
import { currencySchema, moneyMinorSchema } from "./money";

/** Supported payout methods. No automatic payouts in MVP — all are admin-approved. */
export const PAYOUT_METHODS = ["ach", "paypal", "manual"] as const;
export const payoutMethodSchema = z.enum(PAYOUT_METHODS);
export type PayoutMethod = z.infer<typeof payoutMethodSchema>;

/** Payout cadence. MVP supports monthly only. */
export const PAYOUT_FREQUENCIES = ["monthly"] as const;
export const payoutFrequencySchema = z.enum(PAYOUT_FREQUENCIES);
export type PayoutFrequency = z.infer<typeof payoutFrequencySchema>;

/**
 * Default minimum balance required to issue a payout, in minor units
 * ($50.00 → 5000 cents). This is a policy default and is configurable; it is not
 * a magic number scattered through the code.
 */
export const DEFAULT_MINIMUM_PAYOUT_BALANCE_MINOR = 5000;

/**
 * Payout lifecycle. Every payout requires administrator approval before it can
 * be completed; a `completed` payout is terminal (its ledger record is immutable).
 */
export const PAYOUT_STATUSES = [
  "pending_approval",
  "approved",
  "completed",
  "failed",
  "cancelled",
] as const;
export const payoutStatusSchema = z.enum(PAYOUT_STATUSES);
export type PayoutStatus = z.infer<typeof payoutStatusSchema>;

export const createPayoutSchema = z.object({
  partnerId: z.string().uuid(),
  method: payoutMethodSchema,
  amountMinor: moneyMinorSchema,
  currency: currencySchema,
  /** Inclusive start of the payout period (ISO-8601). */
  periodStart: z.string().datetime(),
  /** Exclusive end of the payout period (ISO-8601). */
  periodEnd: z.string().datetime(),
});
export type CreatePayoutInput = z.input<typeof createPayoutSchema>;
export type CreatePayout = z.infer<typeof createPayoutSchema>;

export const payoutSchema = createPayoutSchema.extend({
  id: z.string().uuid(),
  status: payoutStatusSchema,
  approvedBy: z.string().uuid().nullable().default(null),
  approvedAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Payout = z.infer<typeof payoutSchema>;

export const payoutStatusMachine = createStatusMachine<PayoutStatus>({
  pending_approval: ["approved", "cancelled"],
  approved: ["completed", "failed"],
  completed: [],
  failed: [],
  cancelled: [],
});

/** Whether a partner's available balance meets the minimum required to pay out. */
export function meetsMinimumPayout(
  balanceMinor: number,
  minimumMinor: number = DEFAULT_MINIMUM_PAYOUT_BALANCE_MINOR,
): boolean {
  return balanceMinor >= minimumMinor;
}
