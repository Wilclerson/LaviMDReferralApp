import { describe, expect, it } from "vitest";
import { resolveLastClickAttribution, type ReferralTouch } from "./attribution";

const PURCHASE = "2026-07-21T12:00:00.000Z";

const touch = (referralId: string, partnerId: string, occurredAt: string): ReferralTouch => ({
  referralId,
  partnerId,
  occurredAt,
});

describe("resolveLastClickAttribution", () => {
  it("returns null when there are no touches", () => {
    expect(resolveLastClickAttribution([], PURCHASE)).toBeNull();
  });

  it("picks the most recent touch within the window (last click wins)", () => {
    const result = resolveLastClickAttribution(
      [
        touch("r1", "p1", "2026-07-01T00:00:00.000Z"),
        touch("r2", "p2", "2026-07-20T00:00:00.000Z"),
        touch("r3", "p3", "2026-07-10T00:00:00.000Z"),
      ],
      PURCHASE,
    );
    expect(result).toMatchObject({ referralId: "r2", partnerId: "p2", source: "last_click" });
  });

  it("ignores touches outside the 30-day window", () => {
    const result = resolveLastClickAttribution(
      [touch("old", "p1", "2026-06-01T00:00:00.000Z")],
      PURCHASE,
    );
    expect(result).toBeNull();
  });

  it("ignores touches that occur after the purchase", () => {
    const result = resolveLastClickAttribution(
      [
        touch("after", "p2", "2026-07-21T13:00:00.000Z"),
        touch("before", "p1", "2026-07-20T00:00:00.000Z"),
      ],
      PURCHASE,
    );
    expect(result?.referralId).toBe("before");
  });

  it("skips touches with unparseable timestamps", () => {
    const result = resolveLastClickAttribution(
      [touch("bad", "p1", "not-a-date"), touch("good", "p2", "2026-07-19T00:00:00.000Z")],
      PURCHASE,
    );
    expect(result?.referralId).toBe("good");
  });

  it("respects a custom window", () => {
    const touches = [touch("r1", "p1", "2026-07-15T00:00:00.000Z")];
    expect(resolveLastClickAttribution(touches, PURCHASE, 3)).toBeNull();
    expect(resolveLastClickAttribution(touches, PURCHASE, 30)?.referralId).toBe("r1");
  });

  it("throws on an invalid purchase timestamp", () => {
    expect(() => resolveLastClickAttribution([], "nope")).toThrow(RangeError);
  });
});
