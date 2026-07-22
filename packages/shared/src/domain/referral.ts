import { z } from "zod";

/**
 * Lifecycle states for a referral. Ordered roughly by progression, but the set
 * of legal transitions is defined explicitly in {@link ALLOWED_TRANSITIONS}.
 */
export const REFERRAL_STATUSES = [
  "draft",
  "submitted",
  "accepted",
  "scheduled",
  "completed",
  "declined",
  "cancelled",
] as const;

export const referralStatusSchema = z.enum(REFERRAL_STATUSES);
export type ReferralStatus = z.infer<typeof referralStatusSchema>;

/** Clinical urgency of a referral. */
export const REFERRAL_PRIORITIES = ["routine", "urgent", "emergent"] as const;

export const referralPrioritySchema = z.enum(REFERRAL_PRIORITIES);
export type ReferralPriority = z.infer<typeof referralPrioritySchema>;

/**
 * Payload accepted when creating a referral.
 *
 * NOTE (compliance): `patientRef` is an opaque, non-PHI reference to a patient
 * record held in a dedicated, access-controlled store. No PHI (names, DOB,
 * contact details, clinical narrative beyond `reason`) is modeled here yet;
 * see SECURITY.md and the compliance milestone before adding any.
 */
export const createReferralSchema = z.object({
  patientRef: z.string().min(1).max(128),
  referringProviderId: z.string().uuid(),
  receivingProviderId: z.string().uuid().optional(),
  specialty: z.string().min(2).max(120),
  reason: z.string().min(3).max(2000),
  priority: referralPrioritySchema.default("routine"),
  notes: z.string().max(5000).optional(),
});
export type CreateReferralInput = z.input<typeof createReferralSchema>;
export type CreateReferral = z.infer<typeof createReferralSchema>;

/** A persisted referral, including server-assigned identity and timestamps. */
export const referralSchema = createReferralSchema.extend({
  id: z.string().uuid(),
  status: referralStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Referral = z.infer<typeof referralSchema>;

/**
 * Legal status transitions. A referral may only move from a key to one of its
 * listed values. Terminal states map to an empty list.
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<ReferralStatus, readonly ReferralStatus[]>> = {
  draft: ["submitted", "cancelled"],
  submitted: ["accepted", "declined", "cancelled"],
  accepted: ["scheduled", "cancelled"],
  scheduled: ["completed", "cancelled"],
  completed: [],
  declined: [],
  cancelled: [],
};

/** Returns true if `to` is a legal next status from `from`. */
export function canTransitionReferral(from: ReferralStatus, to: ReferralStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Returns true once a referral has reached a terminal (non-transitionable) state. */
export function isTerminalReferralStatus(status: ReferralStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}
