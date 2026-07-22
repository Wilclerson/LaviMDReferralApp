import { z } from "zod";

/**
 * Role-based authorization for the LaviMD Partner Network.
 *
 * SECURITY: permissions are derived **server-side** from the authenticated
 * principal's role. Never accept a permission list, role, or capability flag
 * from the client — clients may render UI from these rules, but every decision
 * is re-checked on the server. Access is deny-by-default: a role has only the
 * permissions explicitly granted below.
 */
export const ROLES = ["super_admin", "administrator", "partner", "customer"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

/**
 * The full permission catalog.
 *
 * Note: there is deliberately **no** permission for customer clinical
 * information — this platform holds no clinical data at all (see PROJECT.md),
 * so such access is denied by absence rather than by rule.
 */
export const PERMISSIONS = [
  // System administration (Super Admin only)
  "system.settings.manage",
  "system.security.manage",
  "system.integrations.manage",
  "system.audit_log.view",
  "administrator.manage",
  "super_admin.manage",

  // Program configuration (Super Admin only)
  "commission_plan.manage",
  "payout_settings.manage",
  "partner_category.manage",

  // Partner administration
  "partner.approve",
  "partner.suspend",
  "partner.view_any",

  // Partner self-service
  "partner.profile.edit_own",
  "partner.document.upload_own",

  // Referrals
  "referral.manage",
  "referral.view_any",
  "referral.view_own",
  "referral.link.generate",
  "referral.qr.generate",

  // Transactions
  "transaction.review",
  "transaction.view_any",
  "transaction.view_own",

  // Commissions
  "commission.approve",
  "commission.view_any",
  "commission.view_own",

  // Payouts
  "payout.batch.create",
  "payout.view_any",
  "payout.view_own",

  // Content
  "education.manage",
  "education.view",
  "certification.complete",
  "marketing_asset.manage",
  "marketing_asset.view",
  "announcement.manage",

  // Reporting
  "financial_report.view",

  // Account
  "account.manage_own",
  "onboarding.complete",
] as const;

export const permissionSchema = z.enum(PERMISSIONS);
export type Permission = z.infer<typeof permissionSchema>;

/** Super Admin has full system access — every permission in the catalog. */
const SUPER_ADMIN_PERMISSIONS: readonly Permission[] = PERMISSIONS;

/**
 * Administrators run the program day to day. They explicitly CANNOT change
 * system/security settings, manage integrations, view audit logs, create or
 * manage Super Admins, or configure commission plans, payout settings, or
 * partner categories — those are Super Admin only.
 */
const ADMINISTRATOR_PERMISSIONS: readonly Permission[] = [
  "partner.approve",
  "partner.suspend",
  "partner.view_any",
  "referral.manage",
  "referral.view_any",
  "transaction.review",
  "transaction.view_any",
  "commission.approve",
  "commission.view_any",
  "payout.batch.create",
  "payout.view_any",
  "education.manage",
  "education.view",
  "marketing_asset.manage",
  "marketing_asset.view",
  "announcement.manage",
  // Administrators review transactions, approve commissions, and build payout
  // batches, so they need financial visibility. (Only partners are explicitly
  // barred from financial reports.)
  "financial_report.view",
  "account.manage_own",
];

/**
 * Partners see only their own data. They can never view another partner's
 * information, approve commissions, modify commission rules, view financial
 * reports, view audit logs, or view transactions that are not theirs — all of
 * which are denied simply by not being granted here.
 */
const PARTNER_PERMISSIONS: readonly Permission[] = [
  "partner.profile.edit_own",
  "partner.document.upload_own",
  "education.view",
  "certification.complete",
  "marketing_asset.view",
  "referral.view_own",
  "referral.link.generate",
  "referral.qr.generate",
  "transaction.view_own",
  "commission.view_own",
  "payout.view_own",
  "account.manage_own",
];

/**
 * Customers never see commissions or partner administration. Registration
 * itself is a public, unauthenticated action and therefore is not a permission.
 */
const CUSTOMER_PERMISSIONS: readonly Permission[] = [
  "education.view",
  "onboarding.complete",
  "account.manage_own",
];

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  super_admin: SUPER_ADMIN_PERMISSIONS,
  administrator: ADMINISTRATOR_PERMISSIONS,
  partner: PARTNER_PERMISSIONS,
  customer: CUSTOMER_PERMISSIONS,
};

const PERMISSION_SETS: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  super_admin: new Set(SUPER_ADMIN_PERMISSIONS),
  administrator: new Set(ADMINISTRATOR_PERMISSIONS),
  partner: new Set(PARTNER_PERMISSIONS),
  customer: new Set(CUSTOMER_PERMISSIONS),
};

/** Returns true if `role` holds `permission`. Deny-by-default. */
export function can(role: Role, permission: Permission): boolean {
  return PERMISSION_SETS[role].has(permission);
}

/** Returns true only if `role` holds every listed permission. */
export function canAll(role: Role, permissions: readonly Permission[]): boolean {
  return permissions.every((permission) => can(role, permission));
}

/** The authenticated principal making a request. */
export interface Actor {
  role: Role;
  /** Set for `partner` actors: the partner record this actor owns. */
  partnerId?: string;
}

/**
 * Resource types that belong to a partner and are therefore subject to
 * "view any" vs. "view only your own" scoping.
 */
export const PARTNER_OWNED_RESOURCES = {
  referral: { any: "referral.view_any", own: "referral.view_own" },
  transaction: { any: "transaction.view_any", own: "transaction.view_own" },
  commission: { any: "commission.view_any", own: "commission.view_own" },
  payout: { any: "payout.view_any", own: "payout.view_own" },
} as const satisfies Record<string, { any: Permission; own: Permission }>;

export type PartnerOwnedResource = keyof typeof PARTNER_OWNED_RESOURCES;

/**
 * Authorizes reading a partner-owned record. Roles with the "view any"
 * permission see everything; roles with only "view own" must match the owning
 * partner. Everyone else is denied.
 */
export function canViewPartnerOwnedResource(
  actor: Actor,
  resource: PartnerOwnedResource,
  ownerPartnerId: string,
): boolean {
  const scope = PARTNER_OWNED_RESOURCES[resource];
  if (can(actor.role, scope.any)) return true;
  if (can(actor.role, scope.own)) {
    return actor.partnerId !== undefined && actor.partnerId === ownerPartnerId;
  }
  return false;
}

/** True for roles that administer the platform (Super Admin or Administrator). */
export function isAdminRole(role: Role): boolean {
  return role === "super_admin" || role === "administrator";
}
