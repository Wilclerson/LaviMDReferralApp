/** Default last-click attribution window (the "cookie" duration), in days. */
export const DEFAULT_ATTRIBUTION_WINDOW_DAYS = 30;

/** How an attribution decision was made. */
export const ATTRIBUTION_SOURCES = ["last_click", "admin_override"] as const;
export type AttributionSource = (typeof ATTRIBUTION_SOURCES)[number];

/** A single referral "touch" that could win attribution for a later purchase. */
export interface ReferralTouch {
  referralId: string;
  partnerId: string;
  /** ISO-8601 timestamp of the touch. */
  occurredAt: string;
}

export interface AttributionResult {
  referralId: string;
  partnerId: string;
  source: "last_click";
  /** ISO-8601 timestamp of the winning touch. */
  touchAt: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Resolves last-click attribution: among the touches that occurred at or before
 * the purchase and within `windowDays` of it, the most recent one wins. If two
 * touches share the exact same timestamp, the first in the input order is kept.
 *
 * Returns `null` when no touch qualifies. Administrators may override the result
 * downstream; such overrides are audited (handled by the backend, not here).
 */
export function resolveLastClickAttribution(
  touches: readonly ReferralTouch[],
  purchaseAt: string,
  windowDays: number = DEFAULT_ATTRIBUTION_WINDOW_DAYS,
): AttributionResult | null {
  const purchaseMs = Date.parse(purchaseAt);
  if (Number.isNaN(purchaseMs)) {
    throw new RangeError(`purchaseAt is not a valid ISO-8601 timestamp: ${purchaseAt}`);
  }
  const windowMs = windowDays * MS_PER_DAY;

  let best: ReferralTouch | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;

  for (const touch of touches) {
    const touchMs = Date.parse(touch.occurredAt);
    if (Number.isNaN(touchMs)) continue;
    if (touchMs > purchaseMs) continue; // touch after the purchase cannot attribute
    if (purchaseMs - touchMs > windowMs) continue; // outside the window
    if (touchMs > bestMs) {
      bestMs = touchMs;
      best = touch;
    }
  }

  if (best === null) return null;
  return {
    referralId: best.referralId,
    partnerId: best.partnerId,
    source: "last_click",
    touchAt: best.occurredAt,
  };
}
