import { describe, expect, it, vi } from "vitest";
import { InMemoryEventBus } from "../common/events/event-bus";
import type { LedgerService } from "./ledger.service";
import { LedgerSubscriber } from "./ledger.subscriber";

function setup(): { bus: InMemoryEventBus; append: ReturnType<typeof vi.fn> } {
  const append = vi.fn(() => Promise.resolve({}));
  const ledger = { append } as unknown as LedgerService;
  const bus = new InMemoryEventBus();
  new LedgerSubscriber(bus, ledger).onModuleInit();
  return { bus, append };
}

describe("LedgerSubscriber", () => {
  it("accrues a ledger entry when a commission is approved", async () => {
    const { bus, append } = setup();
    await bus.emit(
      "commission.approved",
      { commissionId: "c1", partnerId: "p1", amountMinor: 500, currency: "USD" },
      new Date("2026-07-21T12:00:00.000Z"),
    );

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "commission_accrued",
        partnerId: "p1",
        amountMinor: 500,
        referenceId: "c1",
      }),
    );
  });

  it("writes an opposite-signed entry on reversal rather than editing history", async () => {
    const { bus, append } = setup();
    await bus.emit("commission.paid", {
      commissionId: "c1",
      partnerId: "p1",
      amountMinor: -500,
      currency: "USD",
      reversed: true,
    });

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ type: "commission_reversed", amountMinor: -500 }),
    );
  });

  it("ignores a settled (non-reversed) payment event", async () => {
    const { bus, append } = setup();
    await bus.emit("commission.paid", {
      commissionId: "c1",
      partnerId: "p1",
      amountMinor: 500,
      currency: "USD",
    });
    expect(append).not.toHaveBeenCalled();
  });
});
