import type { Permission } from "@lavimd/shared";
import { createParamDecorator, type ExecutionContext, SetMetadata } from "@nestjs/common";
import type { AuthenticatedUser, RequestWithUser } from "../types/authenticated-user";

export const IS_PUBLIC_KEY = "lavimd:isPublic";

/** Marks a route as reachable without authentication. Use sparingly. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

export const REQUIRED_PERMISSIONS_KEY = "lavimd:requiredPermissions";

/**
 * Declares the permissions a route requires. The guard denies the request
 * unless the resolved permission set contains **all** of them.
 */
export const RequirePermissions = (
  ...permissions: Permission[]
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

/** Injects the authenticated principal into a handler parameter. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    if (request.user === undefined) {
      throw new Error("CurrentUser used on a route without authentication");
    }
    return request.user;
  },
);
