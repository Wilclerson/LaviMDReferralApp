import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("reports liveness without touching the database", () => {
    const queryRaw = vi.fn();
    const controller = new HealthController({ $queryRaw: queryRaw } as unknown as PrismaService);
    expect(controller.live()).toEqual({ status: "ok" });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("reports readiness when the database responds", async () => {
    const controller = new HealthController({
      $queryRaw: vi.fn(() => Promise.resolve([{ "?column?": 1 }])),
    } as unknown as PrismaService);
    await expect(controller.ready()).resolves.toEqual({ status: "ok" });
  });

  it("reports unavailable when the database is unreachable", async () => {
    const controller = new HealthController({
      $queryRaw: vi.fn(() => Promise.reject(new Error("ECONNREFUSED"))),
    } as unknown as PrismaService);
    await expect(controller.ready()).rejects.toThrow(ServiceUnavailableException);
  });
});
