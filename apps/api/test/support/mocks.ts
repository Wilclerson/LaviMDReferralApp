import type { Permission, Role } from "@lavimd/shared";
import { resolvePermissions } from "@lavimd/shared";
import type { ExecutionContext } from "@nestjs/common";
import { vi } from "vitest";
import type { AuthenticatedUser } from "../../src/common/types/authenticated-user";

export function actor(role: Role, partnerId: string | null = null): AuthenticatedUser {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    email: `${role}@example.com`,
    role,
    partnerId,
    permissions: resolvePermissions(role) as Set<Permission>,
  };
}

export interface FakeRequest {
  headers: Record<string, string | undefined>;
  user?: AuthenticatedUser;
  ip?: string;
  url?: string;
  method?: string;
}

export function executionContext(request: FakeRequest, response: unknown = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: <T>() => request as T,
      getResponse: <T>() => response as T,
      getNext: <T>() => undefined as T,
    }),
    getHandler: () => vi.fn(),
    getClass: () => vi.fn(),
  } as unknown as ExecutionContext;
}

/** A Reflector stub that returns fixed metadata regardless of the key order. */
export function reflectorStub(values: Record<string, unknown>): {
  getAllAndOverride: (key: string) => unknown;
} {
  return {
    getAllAndOverride: (key: string) => values[key],
  };
}
