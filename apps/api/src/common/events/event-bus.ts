import {
  createDomainEvent,
  type DomainEvent,
  type DomainEventType,
  type EventPublisher,
} from "@lavimd/shared";
import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

export type DomainEventHandler = (event: DomainEvent) => void | Promise<void>;

/**
 * A deliberately simple in-process event bus — no external broker.
 *
 * Business logic publishes events instead of calling unrelated services
 * directly (e.g. approving a commission publishes `commission.approved`, and
 * the ledger subscriber reacts by writing an entry).
 *
 * Handlers run sequentially. A throwing handler is logged and does not prevent
 * the remaining handlers from running, so one subscriber cannot break another.
 */
@Injectable()
export class InMemoryEventBus implements EventPublisher {
  private readonly logger = new Logger(InMemoryEventBus.name);
  private readonly handlers = new Map<DomainEventType, Set<DomainEventHandler>>();

  subscribe(type: DomainEventType, handler: DomainEventHandler): () => void {
    const existing = this.handlers.get(type) ?? new Set<DomainEventHandler>();
    existing.add(handler);
    this.handlers.set(type, existing);
    return () => existing.delete(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    const subscribers = this.handlers.get(event.type);
    if (subscribers === undefined) return;
    for (const handler of subscribers) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(
          `Handler for "${event.type}" failed: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }
  }

  /** Convenience publisher that stamps the event id and timestamp. */
  async emit(
    type: DomainEventType,
    payload: Record<string, unknown>,
    occurredAt: Date = new Date(),
  ): Promise<void> {
    await this.publish(createDomainEvent(randomUUID(), type, occurredAt.toISOString(), payload));
  }
}
