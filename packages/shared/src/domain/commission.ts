import { z } from "zod";
import { createStatusMachine } from "../utils/state-machine";
import { currencySchema, moneyMinorSchema } from "./money";

/**
 * A commission owed to a partner for an eligible transaction made by a customer
 * they referred.
 *
 * Core business rule: commission is earned **only on administrator-approved
 * eligible transactions**. A commission is not payable until an administrator
 * moves it to `approved`; this is enforced by the state machine and by
 * {@link isCommissionPayable}.
 *
 * Lifecycle:
 *   pending_review — eligible transaction recorded; awaiting administrator review
 *   approved       — an administrator approved it; now payable
 *   rejected       — an administrator rejected it; never paid (terminal)
 *   paid           — included in a partner payout
 *   reversed       — clawed back after approval/payment (terminal)
 */
export const COMMISSION_STATUSES = [
  "pending_review",
  "approved",
  "rejected",
  "paid",
  "reversed",
] as const;

export const commissionStatusSchema = z.enum(COMMISSION_STATUSES);
export type CommissionStatus = z.infer<typeof commissionStatusSchema>;

export const createCommissionSchema = z.object({
  partnerId: z.string().uuid(),
  referralId: z.string().uuid(),
  /** Opaque, non-PHI reference to the eligible transaction in LaviMD. */
  transactionRef: z.string().min(1).max(128),
  /** The amount the commission is computed from, in minor units. */
  eligibleAmountMinor: moneyMinorSchema,
  /** The computed commission amount, in minor units. */
  commissionAmountMinor: moneyMinorSchema,
  currency: currencySchema,
  /** Identifier of the versioned commission rule set used for this calculation. */
  ruleVersion: z.string().min(1).max(64),
});
export type CreateCommissionInput = z.input<typeof createCommissionSchema>;
export type CreateCommission = z.infer<typeof createCommissionSchema>;

export const commissionSchema = createCommissionSchema.extend({
  id: z.string().uuid(),
  status: commissionStatusSchema,
  /** Administrator (user id) who approved/rejected the commission, if any. */
  approvedBy: z.string().uuid().nullable().default(null),
  approvedAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Commission = z.infer<typeof commissionSchema>;

export const commissionStatusMachine = createStatusMachine<CommissionStatus>({
  pending_review: ["approved", "rejected"],
  approved: ["paid", "reversed"],
  rejected: [],
  paid: ["reversed"],
  reversed: [],
});

/**
 * Whether a commission is currently payable. Only administrator-approved
 * commissions are payable; nothing is paid straight out of review.
 */
export function isCommissionPayable(status: CommissionStatus): boolean {
  return status === "approved";
}
