import {
  createCommissionPlanSchema,
  createPartnerSchema,
  createReferralSchema,
  createTransactionSchema,
  registerCustomerSchema,
} from "@lavimd/shared";
import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { loginSchema } from "../auth/auth.service";

/**
 * OpenAPI component schemas generated from the shared Zod contracts.
 *
 * The domain schemas in `@lavimd/shared` stay the single source of truth — the
 * documentation is derived from them rather than duplicated as DTO classes.
 */
const SCHEMA_SOURCES: Record<string, ZodTypeAny> = {
  Login: loginSchema,
  CreatePartner: createPartnerSchema,
  CreateReferral: createReferralSchema,
  CreateTransaction: createTransactionSchema,
  CreateCommissionPlan: createCommissionPlanSchema,
  RegisterCustomer: registerCustomerSchema,
};

/**
 * `zodToJsonSchema`'s generics recurse through the whole schema type, which
 * exceeds TypeScript's instantiation depth on our larger contracts. The output
 * is plain JSON Schema regardless, so we call it through a narrowed signature.
 */
const convert = zodToJsonSchema as unknown as (schema: ZodTypeAny, options: unknown) => unknown;

function toJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  return convert(schema, { target: "openApi3", $refStrategy: "none" }) as Record<string, unknown>;
}

export function buildComponentSchemas(): Record<string, Record<string, unknown>> {
  const schemas: Record<string, Record<string, unknown>> = {};
  for (const [name, schema] of Object.entries(SCHEMA_SOURCES)) {
    schemas[name] = toJsonSchema(schema);
  }
  return schemas;
}
