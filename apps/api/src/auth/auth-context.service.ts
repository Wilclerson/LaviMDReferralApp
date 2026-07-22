import { type Permission, permissionOverrideSchema, resolvePermissions } from "@lavimd/shared";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user";

/**
 * Builds the authenticated principal for a request.
 *
 * Permissions are resolved **server-side** on every request from the user's
 * role plus any stored per-user overrides, so a revoked permission takes effect
 * immediately. Nothing here reads permissions from the token or the client.
 */
@Injectable()
export class AuthContextService {
  constructor(private readonly prisma: PrismaService) {}

  async buildUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { permissionGrants: true },
    });

    if (user?.isActive !== true) {
      throw new UnauthorizedException("Account is not active");
    }

    const overrides = user.permissionGrants
      .map((grant) =>
        permissionOverrideSchema.safeParse({
          permission: grant.permission,
          effect: grant.effect,
        }),
      )
      // Ignore stored grants that no longer match the permission catalog.
      .flatMap((parsed) => (parsed.success ? [parsed.data] : []));

    const permissions: ReadonlySet<Permission> = resolvePermissions(user.role, overrides);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      partnerId: user.partnerId,
      permissions,
    };
  }
}
