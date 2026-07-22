import { z } from "zod";
import { currencySchema, moneyMinorSchema } from "./money";

/** Where a transaction record came from. MVP uses `manual`; others arrive via the ingestion layer. */
export const TRANSACTION_SOURCES = ["manual", "csv", "api", "webhook"] as const;
export const transactionSourceSchema = z.enum(TRANSACTION_SOURCES);
export type TransactionSource = z.infer<typeof transactionSourceSchema>;

/** Settlement state of the underlying payment. */
export const SETTLEMENT_STATUSES = ["pending", "settled", "failed"] as const;
export const settlementStatusSchema = z.enum(SETTLEMENT_STATUSES);
export type SettlementStatus = z.infer<typeof settlementStatusSchema>;

export const createTransactionSchema = z.object({
  referralId: z.string().uuid(),
  source: transactionSourceSchema,
  /** Opaque external identifier from the source system (order id, etc.). */
  externalRef: z.string().min(1).max(200).optional(),
  amountMinor: moneyMinorSchema,
  currency: currencySchema,
  occurredAt: z.string().datetime(),
  settlementStatus: settlementStatusSchema.default("pending"),
  refunded: z.boolean().default(false),
  chargedBack: z.boolean().default(false),
  cancelled: z.boolean().default(false),
});
export type CreateTransactionInput = z.input<typeof createTransactionSchema>;
export type CreateTransaction = z.infer<typeof createTransactionSchema>;

export const transactionSchema = createTransactionSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Transaction = z.infer<typeof transactionSchema>;

/**
 * The objective conditions that make a transaction eligible for commission.
 * `partnerActive` and `attributionValid` are supplied by the caller because they
 * depend on state outside the transaction itself.
 */
export interface TransactionEligibilityInput {
  settlementStatus: SettlementStatus;
  refunded: boolean;
  chargedBack: boolean;
  cancelled: boolean;
}

export interface TransactionEligibilityContext {
  partnerActive: boolean;
  attributionValid: boolean;
}

export interface TransactionEligibility {
  eligible: boolean;
  /** Machine-readable reasons the transaction is NOT eligible; empty when eligible. */
  reasons: string[];
}

/**
 * Evaluates whether a transaction meets the objective eligibility rules.
 *
 * NOTE: administrator approval is a *separate*, final gate modeled by the
 * commission state machine (`pending_review -> approved`). This function only
 * decides whether a commission should be raised for review; no commission is
 * ever earned until an administrator approves it.
 */
export function evaluateTransactionEligibility(
  txn: TransactionEligibilityInput,
  ctx: TransactionEligibilityContext,
): TransactionEligibility {
  const reasons: string[] = [];
  if (txn.settlementStatus !== "settled") reasons.push("payment_not_settled");
  if (txn.refunded) reasons.push("refunded");
  if (txn.chargedBack) reasons.push("charged_back");
  if (txn.cancelled) reasons.push("cancelled");
  if (!ctx.attributionValid) reasons.push("invalid_attribution");
  if (!ctx.partnerActive) reasons.push("partner_inactive");
  return { eligible: reasons.length === 0, reasons };
}
