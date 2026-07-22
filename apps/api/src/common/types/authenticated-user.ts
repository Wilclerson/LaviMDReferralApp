import type { Permission, Role } from "@lavimd/shared";
import type { Request } from "express";

/**
 * The authenticated principal for a request. `permissions` is resolved
 * server-side from the user's role plus any stored overrides — it is never
 * derived from anything the client sends.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  /** Set for partner users: the partner record they own. */
  partnerId: string | null;
  permissions: ReadonlySet<Permission>;
}

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}
