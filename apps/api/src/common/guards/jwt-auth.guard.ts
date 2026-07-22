import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { AuthContextService } from "../../auth/auth-context.service";
import { IS_PUBLIC_KEY } from "../decorators";
import type { RequestWithUser } from "../types/authenticated-user";

interface JwtPayload {
  sub: string;
}

/**
 * Authenticates every request by default. Routes opt out explicitly with
 * `@Public()`; there is no implicit anonymous access.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly authContext: AuthContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = extractBearerToken(request.headers.authorization);
    if (token === null) {
      throw new UnauthorizedException("Missing bearer token");
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }

    request.user = await this.authContext.buildUser(payload.sub);
    return true;
  }
}

export function extractBearerToken(header: string | undefined): string | null {
  if (header === undefined) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || value === undefined || value.length === 0) {
    return null;
  }
  return value;
}
