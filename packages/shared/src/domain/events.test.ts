import { describe, expect, it } from "vitest";
import {
  createDomainEvent,
  DOMAIN_EVENT_TYPES,
  isDomainEventType,
  type EventPublisher,
} from "./events";

describe("DOMAIN_EVENT_TYPES", () => {
  it("contains the nine product events", () => {
    expect(DOMAIN_EVENT_TYPES).toHaveLength(9);
    expect(DOMAIN_EVENT_TYPES).toContain("purchase.completed");
    expect(DOMAIN_EVENT_TYPES).toContain("commission.approved");
    expect(DOMAIN_EVENT_TYPES).toContain("payout.completed");
  });
});

describe("isDomainEventType", () => {
  it("recognizes known types and rejects unknown ones", () => {
    expect(isDomainEventType("commission.paid")).toBe(true);
    expect(isDomainEventType("commission.exploded")).toBe(false);
  });
});

describe("createDomainEvent", () => {
  it("constructs a typed event", () => {
    const event = createDomainEvent("evt-1", "commission.approved", "2026-07-21T12:00:00.000Z", {
      commissionId: "c1",
    });
    expect(event).toEqual({
      id: "evt-1",
      type: "commission.approved",
      occurredAt: "2026-07-21T12:00:00.000Z",
      payload: { commissionId: "c1" },
    });
  });

  it("throws on an unknown event type", () => {
    expect(() =>
      // @ts-expect-error deliberately passing an invalid event type
      createDomainEvent("evt-2", "nope.happened", "2026-07-21T12:00:00.000Z", {}),
    ).toThrow(RangeError);
  });

  it("can be published through an EventPublisher", async () => {
    const published: string[] = [];
    const publisher: EventPublisher = {
      publish(event) {
        published.push(event.type);
      },
    };
    await publisher.publish(
      createDomainEvent("evt-3", "referral.created", "2026-07-21T12:00:00.000Z", {
        referralId: "r1",
      }),
    );
    expect(published).toEqual(["referral.created"]);
  });
});
