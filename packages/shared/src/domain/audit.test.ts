import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, auditEntrySchema, createAuditEntrySchema } from "./audit";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const NOW = "2026-07-21T12:00:00.000Z";

const base = {
  action: "commission.approved",
  actorUserId: UUID,
  actorRole: "administrator",
  entityType: "commission",
  entityId: UUID,
  reason: "Verified settled order #1234",
};

describe("AUDIT_ACTIONS", () => {
  it("covers every required sensitive action", () => {
    expect(AUDIT_ACTIONS).toHaveLength(13);
    for (const action of [
      "partner.approved",
      "partner.suspended",
      "commission.approved",
      "commission.rejected",
      "commission.reversed",
      "payout.created",
      "payout.approved",
      "payout.cancelled",
      "commission_plan.changed",
      "role.changed",
      "permission.changed",
      "attribution.overridden",
      "transaction.imported_manually",
    ]) {
      expect(AUDIT_ACTIONS).toContain(action);
    }
  });
});

describe("createAuditEntrySchema", () => {
  it("defaults ip and previous/new values to null", () => {
    const parsed = createAuditEntrySchema.parse(base);
    expect(parsed.ip).toBeNull();
    expect(parsed.previousValue).toBeNull();
    expect(parsed.newValue).toBeNull();
  });

  it("captures previous and new values", () => {
    const parsed = createAuditEntrySchema.parse({
      ...base,
      previousValue: { status: "pending_review" },
      newValue: { status: "approved" },
      ip: "203.0.113.7",
    });
    expect(parsed.previousValue).toEqual({ status: "pending_review" });
    expect(parsed.newValue).toEqual({ status: "approved" });
    expect(parsed.ip).toBe("203.0.113.7");
  });

  it("requires a reason", () => {
    expect(createAuditEntrySchema.safeParse({ ...base, reason: "" }).success).toBe(false);
  });

  it("rejects an unknown action", () => {
    expect(createAuditEntrySchema.safeParse({ ...base, action: "partner.deleted" }).success).toBe(
      false,
    );
  });

  it("rejects a non-UUID actor", () => {
    expect(createAuditEntrySchema.safeParse({ ...base, actorUserId: "admin" }).success).toBe(false);
  });
});

describe("auditEntrySchema", () => {
  it("accepts a fully-formed persisted entry", () => {
    const result = auditEntrySchema.safeParse({ ...base, id: UUID, occurredAt: NOW });
    expect(result.success).toBe(true);
  });
});
