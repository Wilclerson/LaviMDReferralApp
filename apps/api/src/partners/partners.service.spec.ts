import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { actor } from "../../test/support/mocks";
import type { AuditService } from "../audit/audit.service";
import type { PrismaService } from "../prisma/prisma.service";
import { PartnersService } from "./partners.service";

const PARTNER = { id: "p1", status: "pending", displayName: "Sample" };

function setup(partner: unknown = PARTNER): {
  service: PartnersService;
  update: ReturnType<typeof vi.fn>;
  audit: AuditService;
} {
  const update = vi.fn((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ ...(partner as object), ...args.data }),
  );
  const prisma = {
    partner: {
      findUnique: vi.fn(() => Promise.resolve(partner)),
      create: vi.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "p9", ...args.data }),
      ),
      findMany: vi.fn(() => Promise.resolve([PARTNER])),
      count: vi.fn(() => Promise.resolve(1)),
      update,
    },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      Promise.resolve(fn({ partner: { update }, auditLog: { create: vi.fn() } })),
    ),
  } as unknown as PrismaService;
  const audit = { record: vi.fn(() => Promise.resolve()) } as unknown as AuditService;
  return { service: new PartnersService(prisma, audit), update, audit };
}

describe("PartnersService.approve", () => {
  it("moves pending -> active and audits with previous/new values", async () => {
    const { service, update, audit } = setup();
    await service.approve("p1", {
      actor: actor("administrator"),
      ip: "203.0.113.7",
      reason: "Documents verified",
    });

    expect(update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { status: "active" } });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "partner.approved",
        previousValue: { status: "pending" },
        newValue: { status: "active" },
        reason: "Documents verified",
      }),
      expect.anything(),
    );
  });

  it("refuses an illegal transition from a terminal state", async () => {
    const { service } = setup({ ...PARTNER, status: "deactivated" });
    await expect(
      service.approve("p1", { actor: actor("administrator"), ip: null, reason: "x" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("404s for an unknown partner", async () => {
    const { service } = setup(null);
    await expect(
      service.approve("nope", { actor: actor("administrator"), ip: null, reason: "x" }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe("PartnersService.suspend", () => {
  it("moves active -> suspended and audits", async () => {
    const { service, audit } = setup({ ...PARTNER, status: "active" });
    await service.suspend("p1", {
      actor: actor("administrator"),
      ip: null,
      reason: "Policy violation",
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "partner.suspended" }),
      expect.anything(),
    );
  });
});

describe("PartnersService.findByIdForActor", () => {
  it("lets an administrator read any partner", async () => {
    const { service } = setup();
    await expect(service.findByIdForActor("p1", actor("administrator"))).resolves.toMatchObject({
      id: "p1",
    });
  });

  it("lets a partner read their own record", async () => {
    const { service } = setup();
    await expect(service.findByIdForActor("p1", actor("partner", "p1"))).resolves.toMatchObject({
      id: "p1",
    });
  });

  it("denies a partner reading another partner", async () => {
    const { service } = setup();
    await expect(service.findByIdForActor("p1", actor("partner", "p2"))).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe("PartnersService.create/list", () => {
  it("creates a partner from a validated payload", async () => {
    const { service } = setup();
    await expect(
      service.create({
        displayName: "Gym Co",
        category: "gym",
        email: "gym@example.com",
        referralCode: "GYMCODE1",
      }),
    ).resolves.toMatchObject({ id: "p9" });
  });

  it("clamps pagination", async () => {
    const { service } = setup();
    const result = await service.list({ page: -3, pageSize: 5000 });
    expect(result).toMatchObject({ page: 1, pageSize: 100, total: 1 });
  });
});
