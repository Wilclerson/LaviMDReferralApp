import { z } from "zod";
import { createStatusMachine } from "../utils/state-machine";

/**
 * Professional partner categories in the LaviMD Partner Network. Partners are
 * non-medical professionals. They share content and referral links and invite
 * customers to LaviMD — they never practice medicine, diagnose, prescribe, or
 * recommend treatments. See PROJECT.md ("Things that must never change").
 */
export const PARTNER_CATEGORIES = [
  "personal_trainer",
  "hairstylist",
  "esthetician",
  "barber",
  "wellness_coach",
  "massage_therapist",
  "chiropractor",
  "gym",
  "influencer",
] as const;

export const partnerCategorySchema = z.enum(PARTNER_CATEGORIES);
export type PartnerCategory = z.infer<typeof partnerCategorySchema>;

/** Lifecycle of a partner account. Only `active` partners can earn commission. */
export const PARTNER_STATUSES = ["pending", "active", "suspended", "deactivated"] as const;

export const partnerStatusSchema = z.enum(PARTNER_STATUSES);
export type PartnerStatus = z.infer<typeof partnerStatusSchema>;

/** A partner's public referral code: uppercase alphanumeric, 6–20 characters. */
export const referralCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{6,20}$/, "Referral code must be 6–20 uppercase letters/digits");
export type ReferralCode = z.infer<typeof referralCodeSchema>;

export const createPartnerSchema = z.object({
  displayName: z.string().min(2).max(120),
  category: partnerCategorySchema,
  email: z.string().email().max(254),
  referralCode: referralCodeSchema,
});
export type CreatePartnerInput = z.input<typeof createPartnerSchema>;
export type CreatePartner = z.infer<typeof createPartnerSchema>;

export const partnerSchema = createPartnerSchema.extend({
  id: z.string().uuid(),
  status: partnerStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Partner = z.infer<typeof partnerSchema>;

export const partnerStatusMachine = createStatusMachine<PartnerStatus>({
  pending: ["active", "deactivated"],
  active: ["suspended", "deactivated"],
  suspended: ["active", "deactivated"],
  deactivated: [],
});

/**
 * A partner may only accrue commission while `active`. Suspended, pending, and
 * deactivated partners never earn commission on new eligible transactions.
 */
export function isPartnerEligibleForCommission(status: PartnerStatus): boolean {
  return status === "active";
}
