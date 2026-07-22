import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { actor } from "../../test/support/mocks";
import type { PrismaService } from "../prisma/prisma.service";
import { LedgerService } from "./ledger.service";

const ENTRIES = [
  {
    id: "l1",
    type: "commission_accrued",
    partnerId: "p1",
    amountMinor: 500,
    currency: "USD",
    referenceId: "c1",
    occurredAt: new Date("2026-07-21T12:00:00.000Z"),
  },
  {
    id: "l2",
    type: "commission_reversed",
    partnerId: "p1",
    amountMinor: -200,
    currency: "USD",
    referenceId: "c1",
    occurredAt: new Date("2026-07-22T12:00:00.000Z"),
  },
];

function setup(): {
  service: LedgerService;
  create: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
} {
  const create = vi.fn((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: "l9", ...args.data }),
  );
  const findMany = vi.fn(() => Promise.resolve(ENTRIES));
  const prisma = {
    ledgerEntry: { create, findMany, count: vi.fn(() => Promise.resolve(ENTRIES.length)) },
  } as unknown as PrismaService;
  return { service: new LedgerService(prisma), create, findMany };
}

describe("LedgerService", () => {
  it("appends an entry", async () => {
    const { service, create } = setup();
    await service.append({
      type: "commission_accrued",
      partnerId: "p1",
      amountMinor: 500,
      currency: "USD",
      referenceId: "c1",
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "commission_accrued", amountMinor: 500 }),
    });
  });

  it("exposes no update or delete operation — the ledger is append-only", () => {
    const { service } = setup();
    expect("update" in service).toBe(false);
    expect("delete" in service).toBe(false);
  });

  it("sums signed entries into a balance", async () => {
    const { service } = setup();
    await expect(service.balanceForPartner("p1")).resolves.toBe(300);
  });

  it("forces a partner onto their own id even if they ask for another", async () => {
    const { service, findMany } = setup();
    await service.listForActor(actor("partner", "p1"), "p2");
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { partnerId: "p1" } }));
  });

  it("lets an administrator filter by any partner", async () => {
    const { service, findMany } = setup();
    await service.listForActor(actor("administrator"), "p2");
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { partnerId: "p2" } }));
  });

  it("lets an administrator list every entry", async () => {
    const { service, findMany } = setup();
    await service.listForActor(actor("administrator"), undefined);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it("denies a customer", async () => {
    const { service } = setup();
    await expect(service.listForActor(actor("customer"), undefined)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
