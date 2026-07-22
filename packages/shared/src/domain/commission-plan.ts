import { z } from "zod";
import { computeCommissionMinor, currencySchema, moneyMinorSchema } from "./money";

/**
 * How a commission is calculated for a level.
 * - `percentage`: a basis-point rate of the eligible amount.
 * - `flat`: a fixed amount per eligible transaction.
 * - `hybrid`: flat amount plus a percentage.
 *
 * Rates and amounts are always data (never hard-coded); they live in versioned
 * commission plans created by administrators.
 */
export const COMMISSION_CALC_TYPES = ["percentage", "flat", "hybrid"] as const;
export const commissionCalcTypeSchema = z.enum(COMMISSION_CALC_TYPES);
export type CommissionCalcType = z.infer<typeof commissionCalcTypeSchema>;

/** A single level's rule within a plan (e.g. Level 1 = 10%, Level 2 = 3%). */
export const commissionRuleSchema = z
  .object({
    level: z.number().int().min(1).max(10),
    calcType: commissionCalcTypeSchema,
    /** Basis points (1% = 100 bps). Required for `percentage` and `hybrid`. */
    rateBasisPoints: z.number().int().nonnegative().max(100_000).optional(),
    /** Fixed amount in minor units. Required for `flat` and `hybrid`. */
    flatAmountMinor: moneyMinorSchema.optional(),
  })
  .superRefine((rule, ctx) => {
    const needsRate = rule.calcType === "percentage" || rule.calcType === "hybrid";
    const needsFlat = rule.calcType === "flat" || rule.calcType === "hybrid";
    if (needsRate && rule.rateBasisPoints === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rateBasisPoints"],
        message: `rateBasisPoints is required for calcType '${rule.calcType}'`,
      });
    }
    if (needsFlat && rule.flatAmountMinor === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["flatAmountMinor"],
        message: `flatAmountMinor is required for calcType '${rule.calcType}'`,
      });
    }
  });
export type CommissionRule = z.infer<typeof commissionRuleSchema>;

const levelsSchema = z
  .array(commissionRuleSchema)
  .min(1)
  .max(10)
  .superRefine((levels, ctx) => {
    const seen = new Set<number>();
    for (const rule of levels) {
      if (seen.has(rule.level)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate level ${rule.level}`,
        });
      }
      seen.add(rule.level);
    }
  });

export const COMMISSION_PLAN_STATUSES = ["draft", "active", "archived"] as const;
export const commissionPlanStatusSchema = z.enum(COMMISSION_PLAN_STATUSES);
export type CommissionPlanStatus = z.infer<typeof commissionPlanStatusSchema>;

export const createCommissionPlanSchema = z.object({
  name: z.string().min(2).max(120),
  currency: currencySchema,
  levels: levelsSchema,
});
export type CreateCommissionPlanInput = z.input<typeof createCommissionPlanSchema>;
export type CreateCommissionPlan = z.infer<typeof createCommissionPlanSchema>;

/**
 * A specific, immutable version of a commission plan. Editing a plan creates a
 * new `version` under the same `planKey`; earned commissions always reference the
 * exact version used, so rate changes never apply retroactively.
 */
export const commissionPlanSchema = z.object({
  id: z.string().uuid(),
  planKey: z.string().uuid(),
  version: z.number().int().min(1),
  name: z.string().min(2).max(120),
  status: commissionPlanStatusSchema,
  currency: currencySchema,
  levels: levelsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CommissionPlan = z.infer<typeof commissionPlanSchema>;

/** Returns the rule for a given level, or `undefined` if the plan has none. */
export function getCommissionRuleForLevel(
  levels: readonly CommissionRule[],
  level: number,
): CommissionRule | undefined {
  return levels.find((rule) => rule.level === level);
}

/**
 * Computes the commission (in minor units) a rule yields for an eligible amount.
 * Percentage components round down; hybrid is flat + percentage.
 */
export function computeRuleCommissionMinor(
  rule: CommissionRule,
  eligibleAmountMinor: number,
): number {
  let total = 0;
  if (rule.calcType === "percentage" || rule.calcType === "hybrid") {
    total += computeCommissionMinor(eligibleAmountMinor, rule.rateBasisPoints ?? 0);
  }
  if (rule.calcType === "flat" || rule.calcType === "hybrid") {
    total += rule.flatAmountMinor ?? 0;
  }
  return total;
}
