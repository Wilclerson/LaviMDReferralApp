import { UnauthorizedException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { JwtService } from "@nestjs/jwt";
import { describe, expect, it, vi } from "vitest";
import {
  actor,
  executionContext,
  reflectorStub,
  type FakeRequest,
} from "../../../test/support/mocks";
import type { AuthContextService } from "../../auth/auth-context.service";
import { IS_PUBLIC_KEY } from "../decorators";
import { extractBearerToken, JwtAuthGuard } from "./jwt-auth.guard";

const jwt = (payload: unknown, shouldThrow = false): JwtService =>
  ({
    verifyAsync: vi.fn(() =>
      shouldThrow ? Promise.reject(new Error("bad")) : Promise.resolve(payload),
    ),
  }) as unknown as JwtService;

const authContext = (): AuthContextService =>
  ({
    buildUser: vi.fn(() => Promise.resolve(actor("administrator"))),
  }) as unknown as AuthContextService;

const build = (metadata: Record<string, unknown>, jwtService: JwtService): JwtAuthGuard =>
  new JwtAuthGuard(reflectorStub(metadata) as unknown as Reflector, jwtService, authContext());

describe("extractBearerToken", () => {
  it("extracts a bearer token case-insensitively", () => {
    expect(extractBearerToken("Bearer abc")).toBe("abc");
    expect(extractBearerToken("bearer abc")).toBe("abc");
  });

  it("returns null for missing, malformed, or non-bearer headers", () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken("Basic abc")).toBeNull();
    expect(extractBearerToken("Bearer")).toBeNull();
    expect(extractBearerToken("Bearer ")).toBeNull();
  });
});

describe("JwtAuthGuard", () => {
  it("allows public routes without a token", async () => {
    const guard = build({ [IS_PUBLIC_KEY]: true }, jwt({}));
    await expect(guard.canActivate(executionContext({ headers: {} }))).resolves.toBe(true);
  });

  it("rejects a request with no bearer token", async () => {
    const guard = build({}, jwt({}));
    await expect(guard.canActivate(executionContext({ headers: {} }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("rejects an invalid token", async () => {
    const guard = build({}, jwt({}, true));
    const ctx = executionContext({ headers: { authorization: "Bearer nope" } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("attaches the resolved principal on success", async () => {
    const guard = build({}, jwt({ sub: "user-1" }));
    const request: FakeRequest = { headers: { authorization: "Bearer good" } };
    await expect(guard.canActivate(executionContext(request))).resolves.toBe(true);
    expect(request.user?.role).toBe("administrator");
  });
});
