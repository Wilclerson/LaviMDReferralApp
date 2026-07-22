import type { Request } from "express";

/**
 * Best-effort client IP for the audit trail. Audit entries store the IP "when
 * available", so this returns `null` rather than guessing.
 *
 * `x-forwarded-for` is only meaningful behind a trusted proxy; configure
 * Express's `trust proxy` before relying on it.
 */
export function clientIp(request: Pick<Request, "ip" | "headers">): string | null {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    const first = forwarded.split(",")[0]?.trim();
    if (first !== undefined && first.length > 0) return first.slice(0, 45);
  }
  if (typeof request.ip === "string" && request.ip.length > 0) {
    return request.ip.slice(0, 45);
  }
  return null;
}
