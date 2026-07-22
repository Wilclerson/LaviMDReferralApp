import { z } from "zod";
import { roleSchema } from "./authorization";

/**
 * Every sensitive administrator action must create an **immutable** audit
 * record. Audit entries are append-only: they are never updated or deleted
 * (enforced by the persistence layer and by exposing no mutation API).
 *
 * Product names map to these constants:
 *   partner.approved              → Partner Approved
 *   partner.suspended             → Partner Suspended
 *   commission.approved           → Commission Approved
 *   commission.rejected           → Commission Rejected
 *   commission.reversed           → Commission Reversed
 *   payout.created                → Payout Created
 *   payout.approved               → Payout Approved
 *   payout.cancelled              → Payout Cancelled
 *   commission_plan.changed       → Commission Plan Changed
 *   role.changed                  → Role Changed
 *   permission.changed            → Permission Changed
 *   attribution.overridden        → Manual Attribution Override
 *   transaction.imported_manually → Manual Transaction Import
 */
export const AUDIT_ACTIONS = [
  "partner.approved",
  "partner.suspended",
  "commission.approved",
  "commission.rejected",
  "commission.reversed",
  "payout.created",
  "payout.approved",
  "payout.cancelled",
  "commission_plan.changed",
  "role.changed",
  "permission.changed",
  "attribution.overridden",
  "transaction.imported_manually",
] as const;

export const auditActionSchema = z.enum(AUDIT_ACTIONS);
export type AuditAction = z.infer<typeof auditActionSchema>;

/**
 * A JSON-serializable snapshot of an entity's state before/after a change.
 * `null` means "not applicable" (e.g. no previous value on creation).
 */
export const auditValueSchema = z.record(z.unknown()).nullable();

/** The payload a caller must supply when recording an audit entry. */
export const createAuditEntrySchema = z.object({
  action: auditActionSchema,
  /** The administrator who performed the action. */
  actorUserId: z.string().uuid(),
  actorRole: roleSchema,
  /** Request IP when available; null when it cannot be determined. */
  ip: z.string().max(45).nullable().default(null),
  /** What was acted upon. */
  entityType: z.string().min(1).max(64),
  entityId: z.string().min(1).max(128),
  previousValue: auditValueSchema.default(null),
  newValue: auditValueSchema.default(null),
  /** Why the action was taken. Always required — audit entries explain themselves. */
  reason: z.string().min(1).max(1000),
});
export type CreateAuditEntryInput = z.input<typeof createAuditEntrySchema>;
export type CreateAuditEntry = z.infer<typeof createAuditEntrySchema>;

export const auditEntrySchema = createAuditEntrySchema.extend({
  id: z.string().uuid(),
  /** When the action occurred (ISO-8601). */
  occurredAt: z.string().datetime(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;
