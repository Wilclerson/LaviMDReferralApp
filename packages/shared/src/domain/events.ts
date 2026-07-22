/**
 * Catalog of internal domain events. Business logic reacts to these events rather
 * than directly calling unrelated services; they are published through a simple
 * in-process event bus implemented by the backend (see the {@link EventPublisher}
 * contract). We deliberately keep this lightweight — no external broker in MVP.
 *
 * Naming maps 1:1 to the product event names:
 *   referral.created    → ReferralCreated
 *   referral.clicked    → ReferralClicked
 *   referral.registered → ReferralRegistered
 *   purchase.completed  → PurchaseCompleted
 *   commission.pending  → CommissionPending
 *   commission.approved → CommissionApproved
 *   commission.paid     → CommissionPaid
 *   payout.created      → PayoutCreated
 *   payout.completed    → PayoutCompleted
 */
export const DOMAIN_EVENT_TYPES = [
  "referral.created",
  "referral.clicked",
  "referral.registered",
  "purchase.completed",
  "commission.pending",
  "commission.approved",
  "commission.paid",
  "payout.created",
  "payout.completed",
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

export function isDomainEventType(value: string): value is DomainEventType {
  return (DOMAIN_EVENT_TYPES as readonly string[]).includes(value);
}

/**
 * An internal domain event. `payload` carries the minimal data subscribers need
 * (typically entity ids and amounts); it is produced by our own code, so it is a
 * typed contract rather than Zod-validated untrusted input.
 */
export interface DomainEvent<
  T extends DomainEventType = DomainEventType,
  P = Record<string, unknown>,
> {
  readonly id: string;
  readonly type: T;
  /** ISO-8601 timestamp the event occurred. */
  readonly occurredAt: string;
  readonly payload: P;
}

/** Constructs a domain event, validating the event type against the catalog. */
export function createDomainEvent<T extends DomainEventType, P>(
  id: string,
  type: T,
  occurredAt: string,
  payload: P,
): DomainEvent<T, P> {
  // Defensive runtime guard: callers can bypass the compile-time constraint
  // (e.g. across an untyped boundary), so validate the widened value.
  const eventType: string = type;
  if (!isDomainEventType(eventType)) {
    throw new RangeError(`Unknown domain event type: ${eventType}`);
  }
  return { id, type, occurredAt, payload };
}

/**
 * Contract for publishing domain events. The backend provides a simple
 * synchronous in-process implementation (Milestone 2); subscribers register
 * their own handlers there. Kept minimal by design.
 */
export interface EventPublisher {
  publish(event: DomainEvent): void | Promise<void>;
}
