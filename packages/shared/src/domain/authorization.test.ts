import { describe, expect, it } from "vitest";
import {
  can,
  canAll,
  canViewPartnerOwnedResource,
  hasPermission,
  isAdminRole,
  PERMISSIONS,
  resolvePermissions,
  ROLE_PERMISSIONS,
  ROLES,
  roleSchema,
  type Permission,
} from "./authorization";

const PARTNER_A = "partner-a";
const PARTNER_B = "partner-b";

describe("roleSchema", () => {
  it("accepts the four roles and rejects anything else", () => {
    for (const role of ROLES) {
      expect(roleSchema.safeParse(role).success).toBe(true);
    }
    expect(roleSchema.safeParse("owner").success).toBe(false);
  });
});

describe("super_admin", () => {
  it("has full system access (every permission)", () => {
    expect(canAll("super_admin", PERMISSIONS)).toBe(true);
    expect(ROLE_PERMISSIONS.super_admin).toHaveLength(PERMISSIONS.length);
  });
});

describe("administrator", () => {
  const allowed: Permission[] = [
    "partner.approve",
    "partner.suspend",
    "referral.manage",
    "transaction.review",
    "commission.approve",
    "payout.batch.create",
    "education.manage",
    "marketing_asset.manage",
    "announcement.manage",
    // Operational financial visibility only.
    "financial_report.view_operational",
  ];

  const denied: Permission[] = [
    "super_admin.manage",
    "administrator.manage",
    "system.security.manage",
    "system.settings.manage",
    "system.integrations.manage",
    "system.audit_log.view",
    "commission_plan.manage",
    "payout_settings.manage",
    "partner_category.manage",
    // Full program-wide financial reporting is Super Admin only.
    "financial_report.view_all",
  ];

  it("can run the program", () => {
    expect(canAll("administrator", allowed)).toBe(true);
  });

  it("cannot change system/security settings or create Super Admins", () => {
    for (const permission of denied) {
      expect(can("administrator", permission)).toBe(false);
    }
  });
});

describe("partner", () => {
  const allowed: Permission[] = [
    "partner.profile.edit_own",
    "partner.document.upload_own",
    "education.view",
    "certification.complete",
    "marketing_asset.view",
    "referral.view_own",
    "commission.view_own",
    "payout.view_own",
    "referral.link.generate",
    "referral.qr.generate",
  ];

  const denied: Permission[] = [
    "partner.view_any",
    "commission.approve",
    "commission_plan.manage",
    "financial_report.view_all",
    "financial_report.view_operational",
    "system.audit_log.view",
    "transaction.view_any",
    "referral.view_any",
    "commission.view_any",
    "payout.view_any",
  ];

  it("can do everything a partner may do", () => {
    expect(canAll("partner", allowed)).toBe(true);
  });

  it("can never do the forbidden things", () => {
    for (const permission of denied) {
      expect(can("partner", permission)).toBe(false);
    }
  });
});

describe("customer", () => {
  it("can view education, onboard, and manage their own account", () => {
    expect(
      canAll("customer", ["education.view", "onboarding.complete", "account.manage_own"]),
    ).toBe(true);
  });

  it("never sees commissions or partner administration", () => {
    for (const permission of [
      "commission.view_any",
      "commission.view_own",
      "commission.approve",
      "partner.view_any",
      "partner.approve",
      "payout.view_any",
    ] satisfies Permission[]) {
      expect(can("customer", permission)).toBe(false);
    }
  });
});

describe("canViewPartnerOwnedResource", () => {
  it("lets administrators view any partner's records", () => {
    expect(canViewPartnerOwnedResource({ role: "administrator" }, "commission", PARTNER_A)).toBe(
      true,
    );
    expect(canViewPartnerOwnedResource({ role: "super_admin" }, "payout", PARTNER_B)).toBe(true);
  });

  it("lets a partner view only their own records", () => {
    const actor = { role: "partner", partnerId: PARTNER_A } as const;
    expect(canViewPartnerOwnedResource(actor, "referral", PARTNER_A)).toBe(true);
    expect(canViewPartnerOwnedResource(actor, "transaction", PARTNER_A)).toBe(true);
    expect(canViewPartnerOwnedResource(actor, "commission", PARTNER_B)).toBe(false);
    expect(canViewPartnerOwnedResource(actor, "payout", PARTNER_B)).toBe(false);
  });

  it("denies a partner actor with no partnerId", () => {
    expect(canViewPartnerOwnedResource({ role: "partner" }, "referral", PARTNER_A)).toBe(false);
  });

  it("denies customers outright", () => {
    expect(canViewPartnerOwnedResource({ role: "customer" }, "commission", PARTNER_A)).toBe(false);
  });
});

describe("resolvePermissions", () => {
  it("returns the role defaults when there are no overrides", () => {
    const resolved = resolvePermissions("partner");
    expect(hasPermission(resolved, "referral.view_own")).toBe(true);
    expect(hasPermission(resolved, "commission.approve")).toBe(false);
  });

  it("grants an extra permission via an allow override", () => {
    const resolved = resolvePermissions("administrator", [
      { permission: "system.audit_log.view", effect: "allow" },
    ]);
    expect(hasPermission(resolved, "system.audit_log.view")).toBe(true);
  });

  it("removes a default permission via a deny override", () => {
    const resolved = resolvePermissions("administrator", [
      { permission: "commission.approve", effect: "deny" },
    ]);
    expect(hasPermission(resolved, "commission.approve")).toBe(false);
  });

  it("lets deny win over allow regardless of order", () => {
    const denyFirst = resolvePermissions("partner", [
      { permission: "referral.view_any", effect: "deny" },
      { permission: "referral.view_any", effect: "allow" },
    ]);
    const allowFirst = resolvePermissions("partner", [
      { permission: "referral.view_any", effect: "allow" },
      { permission: "referral.view_any", effect: "deny" },
    ]);
    expect(hasPermission(denyFirst, "referral.view_any")).toBe(false);
    expect(hasPermission(allowFirst, "referral.view_any")).toBe(false);
  });

  it("does not mutate the role defaults", () => {
    resolvePermissions("customer", [{ permission: "commission.approve", effect: "allow" }]);
    expect(can("customer", "commission.approve")).toBe(false);
  });
});

describe("canViewPartnerOwnedResource with resolved permissions", () => {
  it("honours an override granting cross-partner visibility", () => {
    const actor = {
      role: "partner",
      partnerId: PARTNER_A,
      permissions: resolvePermissions("partner", [
        { permission: "commission.view_any", effect: "allow" },
      ]),
    } as const;
    expect(canViewPartnerOwnedResource(actor, "commission", PARTNER_B)).toBe(true);
  });

  it("honours an override revoking own-data visibility", () => {
    const actor = {
      role: "partner",
      partnerId: PARTNER_A,
      permissions: resolvePermissions("partner", [
        { permission: "referral.view_own", effect: "deny" },
      ]),
    } as const;
    expect(canViewPartnerOwnedResource(actor, "referral", PARTNER_A)).toBe(false);
  });
});

describe("isAdminRole", () => {
  it("is true only for super_admin and administrator", () => {
    expect(isAdminRole("super_admin")).toBe(true);
    expect(isAdminRole("administrator")).toBe(true);
    expect(isAdminRole("partner")).toBe(false);
    expect(isAdminRole("customer")).toBe(false);
  });
});
