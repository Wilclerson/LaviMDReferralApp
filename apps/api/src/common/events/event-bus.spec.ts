import { createDomainEvent } from "@lavimd/shared";
import { describe, expect, it, vi } from "vitest";
import { InMemoryEventBus } from "./event-bus";

const event = createDomainEvent("evt-1", "commission.approved", "2026-07-21T12:00:00.000Z", {
  commissionId: "c1",
});

describe("InMemoryEventBus", () => {
  it("delivers an event to its subscribers", async () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    bus.subscribe("commission.approved", handler);

    await bus.publish(event);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("ignores events with no subscribers", async () => {
    const bus = new InMemoryEventBus();
    await expect(bus.publish(event)).resolves.toBeUndefined();
  });

  it("does not deliver to subscribers of other event types", async () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    bus.subscribe("payout.created", handler);

    await bus.publish(event);
    expect(handler).not.toHaveBeenCalled();
  });

  it("stops delivering after unsubscribe", async () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    const unsubscribe = bus.subscribe("commission.approved", handler);
    unsubscribe();

    await bus.publish(event);
    expect(handler).not.toHaveBeenCalled();
  });

  it("isolates a failing handler from the others", async () => {
    const bus = new InMemoryEventBus();
    const healthy = vi.fn();
    bus.subscribe("commission.approved", () => {
      throw new Error("subscriber exploded");
    });
    bus.subscribe("commission.approved", healthy);

    await expect(bus.publish(event)).resolves.toBeUndefined();
    expect(healthy).toHaveBeenCalledOnce();
  });

  it("stamps id and timestamp when emitting", async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];
    bus.subscribe("referral.created", (incoming) => {
      received.push(incoming.occurredAt);
    });

    await bus.emit("referral.created", { referralId: "r1" }, new Date("2026-07-21T00:00:00.000Z"));
    expect(received).toEqual(["2026-07-21T00:00:00.000Z"]);
  });
});
