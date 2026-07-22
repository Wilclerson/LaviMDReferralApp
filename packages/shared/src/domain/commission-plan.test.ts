import { describe, expect, it } from "vitest";
import {
  commissionPlanSchema,
  commissionRuleSchema,
  computeRuleCommissionMinor,
  createCommissionPlanSchema,
  getCommissionRuleForLevel,
  type CommissionRule,
} from "./commission-plan";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const PLAN_KEY = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const NOW = "2026-07-21T12:00:00.000Z";

const level1: CommissionRule = { level: 1, calcType: "percentage", rateBasisPoints: 1000 }; // 10%
const level2: CommissionRule = { level: 2, calcType: "percentage", rateBasisPoints: 300 }; // 3%

describe("commissionRuleSchema", () => {
  it("accepts a percentage rule with a rate", () => {
    expect(commissionRuleSchema.safeParse(level1).success).toBe(true);
  });

  it("accepts a flat rule with an amount", () => {
    expect(
      commissionRuleSchema.safeParse({ level: 1, calcType: "flat", flatAmountMinor: 250 }).success,
    ).toBe(true);
  });

  it("accepts a hybrid rule with both", () => {
    expect(
      commissionRuleSchema.safeParse({
        level: 1,
        calcType: "hybrid",
        rateBasisPoints: 500,
        flatAmountMinor: 100,
      }).success,
    ).toBe(true);
  });

  it("rejects a percentage rule missing its rate", () => {
    expect(commissionRuleSchema.safeParse({ level: 1, calcType: "percentage" }).success).toBe(
      false,
    );
  });

  it("rejects a flat rule missing its amount", () => {
    expect(commissionRuleSchema.safeParse({ level: 1, calcType: "flat" }).success).toBe(false);
  });

  it("rejects a hybrid rule missing the flat amount", () => {
    expect(
      commissionRuleSchema.safeParse({ level: 1, calcType: "hybrid", rateBasisPoints: 500 })
        .success,
    ).toBe(false);
  });
});

describe("createCommissionPlanSchema", () => {
  it("accepts a multi-level plan (L1 10%, L2 3%)", () => {
    const result = createCommissionPlanSchema.safeParse({
      name: "Standard",
      currency: "USD",
      levels: [level1, level2],
    });
    expect(result.success).toBe(true);
  });

  it("rejects duplicate levels", () => {
    const result = createCommissionPlanSchema.safeParse({
      name: "Bad",
      currency: "USD",
      levels: [level1, { level: 1, calcType: "flat", flatAmountMinor: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty level list", () => {
    const result = createCommissionPlanSchema.safeParse({
      name: "Empty",
      currency: "USD",
      levels: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("commissionPlanSchema", () => {
  it("accepts a fully-formed persisted, versioned plan", () => {
    const result = commissionPlanSchema.safeParse({
      id: UUID,
      planKey: PLAN_KEY,
      version: 1,
      name: "Standard",
      status: "active",
      currency: "USD",
      levels: [level1, level2],
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(result.success).toBe(true);
  });
});

describe("getCommissionRuleForLevel", () => {
  it("finds the rule for a level or returns undefined", () => {
    expect(getCommissionRuleForLevel([level1, level2], 2)).toEqual(level2);
    expect(getCommissionRuleForLevel([level1, level2], 3)).toBeUndefined();
  });
});

describe("computeRuleCommissionMinor", () => {
  it("computes a percentage rule (10% of $50.00 = $5.00)", () => {
    expect(computeRuleCommissionMinor(level1, 5000)).toBe(500);
  });

  it("computes a flat rule", () => {
    expect(
      computeRuleCommissionMinor({ level: 1, calcType: "flat", flatAmountMinor: 250 }, 5000),
    ).toBe(250);
  });

  it("computes a hybrid rule (flat + percentage)", () => {
    expect(
      computeRuleCommissionMinor(
        { level: 1, calcType: "hybrid", rateBasisPoints: 500, flatAmountMinor: 100 },
        5000,
      ),
    ).toBe(350); // 100 flat + 250 (5% of 5000)
  });

  it("defensively treats a missing rate/amount as zero", () => {
    // The CommissionRule *type* permits absent fields (runtime validation lives
    // in commissionRuleSchema); compute must not produce NaN if handed such a rule.
    expect(computeRuleCommissionMinor({ level: 1, calcType: "percentage" }, 5000)).toBe(0);
    expect(computeRuleCommissionMinor({ level: 1, calcType: "flat" }, 5000)).toBe(0);
  });
});
