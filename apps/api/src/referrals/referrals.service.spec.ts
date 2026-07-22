import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { actor } from "../../test/support/mocks";
import { InMemoryEventBus } from "../common/events/event-bus";
import type { PrismaService } from "../prisma/prisma.service";
import { ReferralsService } from "./referrals.service";

const REFERRAL = { id: "r1", partnerId: "p1", referralCode: "LAVI2026" };

function setup(referral: unknown = REFERRAL): {
  service: ReferralsService;
  bus: InMemoryEventBus;
  findMany: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn(() => Promise.resolve([REFERRAL]));
  const prisma = {
    referral: {
      create: vi.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "r9", ...args.data }),
      ),
      findUnique: vi.fn(() => Promise.resolve(referral)),
      findMany,
      count: vi.fn(() => Promise.resolve(1)),
    },
  } as unknown as PrismaService;
  const bus = new InMemoryEventBus();
  return { service: new ReferralsService(prisma, bus), bus, findMany };
}

describe("ReferralsService.create", () => {
  it("creates the attribution touch and publishes referral.created", async () => {
    const { service, bus } = setup();
    const handler = vi.fn();
    bus.subscribe("referral.created", handler);

    const referral = await service.create({
      partnerId: "11111111-1111-4111-8111-111111111111",
      referralCode: "LAVI2026",
    });

    expect(referral).toMatchObject({ id: "r9", channel: "link" });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("rejects an invalid referral code", async () => {
    const { service } = setup();
    await expect(
      service.create({ partnerId: "11111111-1111-4111-8111-111111111111", referralCode: "bad" }),
    ).rejects.toThrow();
  });
});

describe("ReferralsService owner scoping", () => {
  it("lets a partner read their own referral", async () => {
    const { service } = setup();
    await expect(service.findByIdForActor("r1", actor("partner", "p1"))).resolves.toMatchObject({
      id: "r1",
    });
  });

  it("denies a partner reading another partner's referral", async () => {
    const { service } = setup();
    await expect(service.findByIdForActor("r1", actor("partner", "p2"))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("404s for an unknown referral", async () => {
    const { service } = setup(null);
    await expect(service.findByIdForActor("nope", actor("administrator"))).rejects.toThrow(
      NotFoundException,
    );
  });

  it("filters a partner's list query to their own partner id", async () => {
    const { service, findMany } = setup();
    await service.listForActor(actor("partner", "p1"));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { partnerId: "p1" } }));
  });

  it("matches nothing for a partner user with no linked partner record", async () => {
    const { service, findMany } = setup();
    await service.listForActor(actor("partner", null));
    // An empty `in` list matches nothing. A sentinel string would be rejected
    // by PostgreSQL, since partnerId is a UUID column.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { partnerId: { in: [] } } }),
    );
  });

  it("does not filter for an administrator", async () => {
    const { service, findMany } = setup();
    await service.listForActor(actor("administrator"));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it("denies a customer", async () => {
    const { service } = setup();
    await expect(service.listForActor(actor("customer"))).rejects.toThrow(ForbiddenException);
  });
});
