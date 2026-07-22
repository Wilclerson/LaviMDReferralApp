import { z } from "zod";
import { createStatusMachine } from "../utils/state-machine";
import { referralCodeSchema } from "./partner";

/**
 * A referral is a marketing *attribution*: it records that a customer was
 * invited to LaviMD through a partner's referral link/code. This is an
 * affiliate model, not a clinical one — no medical data is modeled here.
 *
 * Lifecycle:
 *   pending    — link/code used or invite sent; customer has not signed up yet
 *   signed_up  — the invited customer created a LaviMD account
 *   converted  — the customer completed at least one eligible transaction
 *   expired    — the attribution window elapsed with no conversion
 *   cancelled  — voided (fraud, partner request, etc.)
 */
export const REFERRAL_STATUSES = [
  "pending",
  "signed_up",
  "converted",
  "expired",
  "cancelled",
] as const;

export const referralStatusSchema = z.enum(REFERRAL_STATUSES);
export type ReferralStatus = z.infer<typeof referralStatusSchema>;

/** How the customer arrived through the partner. */
export const REFERRAL_CHANNELS = ["link", "code", "content", "invite"] as const;

export const referralChannelSchema = z.enum(REFERRAL_CHANNELS);
export type ReferralChannel = z.infer<typeof referralChannelSchema>;

export const createReferralSchema = z.object({
  partnerId: z.string().uuid(),
  referralCode: referralCodeSchema,
  channel: referralChannelSchema.default("link"),
  /**
   * Opaque, non-PHI reference to the invited customer's LaviMD record. Set once
   * the customer is known (e.g. on sign-up). Never store PHI or raw identifiers.
   */
  customerRef: z.string().min(1).max(128).optional(),
});
export type CreateReferralInput = z.input<typeof createReferralSchema>;
export type CreateReferral = z.infer<typeof createReferralSchema>;

export const referralSchema = createReferralSchema.extend({
  id: z.string().uuid(),
  status: referralStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Referral = z.infer<typeof referralSchema>;

export const referralStatusMachine = createStatusMachine<ReferralStatus>({
  pending: ["signed_up", "expired", "cancelled"],
  signed_up: ["converted", "expired", "cancelled"],
  converted: ["cancelled"],
  expired: [],
  cancelled: [],
});
