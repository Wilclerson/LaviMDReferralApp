import type { Reflector } from "@nestjs/core";
import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { actor, executionContext, reflectorStub } from "../../../test/support/mocks";
import { IS_PUBLIC_KEY, REQUIRED_PERMISSIONS_KEY } from "../decorators";
import { PermissionsGuard } from "./permissions.guard";

const guardWith = (metadata: Record<string, unknown>): PermissionsGuard =>
  new PermissionsGuard(reflectorStub(metadata) as unknown as Reflector);

describe("PermissionsGuard", () => {
  it("allows public routes", () => {
    const guard = guardWith({ [IS_PUBLIC_KEY]: true });
    expect(guard.canActivate(executionContext({ headers: {} }))).toBe(true);
  });

  it("allows routes that declare no permissions", () => {
    const guard = guardWith({});
    const ctx = executionContext({ headers: {}, user: actor("partner") });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("allows a principal holding every required permission", () => {
    const guard = guardWith({ [REQUIRED_PERMISSIONS_KEY]: ["commission.approve"] });
    const ctx = executionContext({ headers: {}, user: actor("administrator") });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("denies a principal missing a required permission", () => {
    const guard = guardWith({ [REQUIRED_PERMISSIONS_KEY]: ["commission.approve"] });
    const ctx = executionContext({ headers: {}, user: actor("partner") });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("denies an administrator the Super-Admin-only permissions", () => {
    const guard = guardWith({ [REQUIRED_PERMISSIONS_KEY]: ["system.audit_log.view"] });
    const ctx = executionContext({ headers: {}, user: actor("administrator") });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("denies when there is no authenticated principal", () => {
    const guard = guardWith({ [REQUIRED_PERMISSIONS_KEY]: ["partner.view_any"] });
    expect(() => guard.canActivate(executionContext({ headers: {} }))).toThrow(ForbiddenException);
  });
});
