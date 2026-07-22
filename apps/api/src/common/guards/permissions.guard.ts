import { hasPermission, type Permission } from "@lavimd/shared";
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY, REQUIRED_PERMISSIONS_KEY } from "../decorators";
import type { RequestWithUser } from "../types/authenticated-user";

/**
 * Enforces the permissions declared by `@RequirePermissions()`.
 *
 * Authorization is checked against the permission set resolved server-side for
 * the authenticated principal — never against anything supplied by the client.
 * A route with no declared permissions still requires authentication; handlers
 * that expose partner-owned data additionally scope by owner.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) return true;

    const required = this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required === undefined || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (user === undefined) {
      throw new ForbiddenException("Not authenticated");
    }

    const missing = required.filter((permission) => !hasPermission(user.permissions, permission));
    if (missing.length > 0) {
      throw new ForbiddenException("Insufficient permissions");
    }
    return true;
  }
}
