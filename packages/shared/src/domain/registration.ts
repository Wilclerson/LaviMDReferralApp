import { z } from "zod";

/**
 * Consent captured from a customer. Consent records are append-only: changing a
 * decision writes a new record rather than editing the old one.
 */
export const CONSENT_TYPES = ["terms", "privacy", "marketing"] as const;
export const consentTypeSchema = z.enum(CONSENT_TYPES);
export type ConsentType = z.infer<typeof consentTypeSchema>;

/** Minimum customer password length. Long beats complex. */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 200;

export const consentSchema = z.object({
  /** Version of the policy text presented to the user. */
  version: z.string().min(1).max(32),
  /** Terms and privacy consent are mandatory — registration cannot proceed without them. */
  terms: z.literal(true),
  privacy: z.literal(true),
  /** Marketing consent is optional and defaults to opted-out. */
  marketing: z.boolean().default(false),
});
export type ConsentInput = z.input<typeof consentSchema>;
export type Consent = z.infer<typeof consentSchema>;

/**
 * Customer self-registration. This is a **public, unauthenticated** action —
 * no session exists yet, so it is deliberately not modeled as a permission.
 * Abuse controls (rate limiting, no user enumeration) live at the HTTP edge.
 */
export const registerCustomerSchema = z.object({
  // Normalized before validation: users paste addresses with stray whitespace
  // and mixed case, and the stored form must be canonical so uniqueness holds.
  email: z.string().trim().toLowerCase().email().max(254),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(PASSWORD_MAX_LENGTH)
    .refine((value) => value.trim().length >= PASSWORD_MIN_LENGTH, {
      message: "Password must not be mostly whitespace",
    }),
  consent: consentSchema,
});
export type RegisterCustomerInput = z.input<typeof registerCustomerSchema>;
export type RegisterCustomer = z.infer<typeof registerCustomerSchema>;
