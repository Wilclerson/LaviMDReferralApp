import { z } from "zod";
import { currencySchema } from "./money";

/**
 * Types of immutable, append-only ledger entries. The ledger is the financial
 * source of truth for partner balances; entries are never updated or deleted
 * (immutability is enforced at the persistence layer).
 */
export const LEDGER_ENTRY_TYPES = ["commission_accrued", "commission_reversed", "payout"] as const;
export const ledgerEntryTypeSchema = z.enum(LEDGER_ENTRY_TYPES);
export type LedgerEntryType = z.infer<typeof ledgerEntryTypeSchema>;

export const ledgerEntrySchema = z.object({
  id: z.string().uuid(),
  type: ledgerEntryTypeSchema,
  partnerId: z.string().uuid(),
  /**
   * Signed amount in minor units: positive credits the partner (commission
   * accrued), negative debits (reversal, payout).
   */
  amountMinor: z.number().int(),
  currency: currencySchema,
  /** Id of the entity this entry records (commission id or payout id). */
  referenceId: z.string().min(1).max(128),
  /** ISO-8601 timestamp the financial event occurred. */
  occurredAt: z.string().datetime(),
});
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

/**
 * Sums signed ledger amounts to a running balance (minor units). All entries are
 * expected to share a currency; mixing currencies is a caller error.
 */
export function sumLedgerBalanceMinor(entries: readonly LedgerEntry[]): number {
  return entries.reduce((total, entry) => total + entry.amountMinor, 0);
}
