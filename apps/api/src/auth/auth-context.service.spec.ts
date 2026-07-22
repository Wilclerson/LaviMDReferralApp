import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { AuthContextService } from "./auth-context.service";

function prismaWith(user: unknown): PrismaService {
  return { user: { findUnique: vi.fn(() => Promise.resolve(user)) } } as unknown as PrismaService;
}

const baseUser = {
  id: "u1",
  email: "admin@example.com",
  role: "administrator",
  partnerId: null,
  isActive: true,
  permissionGrants: [] as { permission: string; effect: string }[],
};

describe("AuthContextService.buildUser", () => {
  it("resolves the role's default permissions", async () => {
    const service = new AuthContextService(prismaWith(baseUser));
    const user = await service.buildUser("u1");

    expect(user.role).toBe("administrator");
    expect(user.permissions.has("commission.approve")).toBe(true);
    // Full financial reporting is Super Admin only.
    expect(user.permissions.has("financial_report.view_all")).toBe(false);
    expect(user.permissions.has("financial_report.view_operational")).toBe(true);
  });

  it("applies stored allow and deny overrides", async () => {
    const service = new AuthContextService(
      prismaWith({
        ...baseUser,
        permissionGrants: [
          { permission: "system.audit_log.view", effect: "allow" },
          { permission: "commission.approve", effect: "deny" },
        ],
      }),
    );
    const user = await service.buildUser("u1");

    expect(user.permissions.has("system.audit_log.view")).toBe(true);
    expect(user.permissions.has("commission.approve")).toBe(false);
  });

  it("ignores stored grants that are no longer in the permission catalog", async () => {
    const service = new AuthContextService(
      prismaWith({
        ...baseUser,
        permissionGrants: [{ permission: "legacy.permission", effect: "allow" }],
      }),
    );
    const user = await service.buildUser("u1");
    expect(user.permissions.has("commission.approve")).toBe(true);
  });

  it("rejects an unknown user", async () => {
    const service = new AuthContextService(prismaWith(null));
    await expect(service.buildUser("nope")).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a deactivated user", async () => {
    const service = new AuthContextService(prismaWith({ ...baseUser, isActive: false }));
    await expect(service.buildUser("u1")).rejects.toThrow(UnauthorizedException);
  });
});
