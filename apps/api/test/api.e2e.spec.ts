import type { INestApplication } from "@nestjs/common";
import { VersioningType } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

const SUPER_ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "super@example.com",
  role: "super_admin",
  partnerId: null,
  isActive: true,
  permissionGrants: [],
};

const PARTNER_USER = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "partner@example.com",
  role: "partner",
  partnerId: "p1",
  isActive: true,
  permissionGrants: [],
};

const USERS = new Map([
  [SUPER_ADMIN.id, SUPER_ADMIN],
  [PARTNER_USER.id, PARTNER_USER],
]);

/** A Prisma stand-in — these tests exercise HTTP, guards, and wiring, not SQL. */
const prismaMock = {
  $connect: vi.fn(() => Promise.resolve()),
  $disconnect: vi.fn(() => Promise.resolve()),
  $queryRaw: vi.fn(() => Promise.resolve([{ ok: 1 }])),
  user: {
    findUnique: vi.fn(({ where }: { where: { id?: string } }) =>
      Promise.resolve(where.id === undefined ? null : (USERS.get(where.id) ?? null)),
    ),
  },
  auditLog: {
    findMany: vi.fn(() => Promise.resolve([{ id: "a1", action: "commission_approved" }])),
    count: vi.fn(() => Promise.resolve(1)),
  },
  commission: {
    findMany: vi.fn(() => Promise.resolve([{ id: "c1", partnerId: "p1" }])),
    count: vi.fn(() => Promise.resolve(1)),
    findUnique: vi.fn(() => Promise.resolve({ id: "c1", partnerId: "p9" })),
  },
};

describe("API (e2e)", () => {
  let app: INestApplication;
  let jwt: JwtService;

  beforeAll(async () => {
    process.env["JWT_SECRET"] = "e2e-test-secret-value-at-least-32-chars";
    process.env["DATABASE_URL"] = "postgresql://user:pass@localhost:5432/db";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api", { exclude: ["health/live", "health/ready"] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    await app.init();

    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  const tokenFor = (userId: string): Promise<string> => jwt.signAsync({ sub: userId });

  describe("public routes", () => {
    it("serves liveness without a token", async () => {
      await request(app.getHttpServer()).get("/health/live").expect(200, { status: "ok" });
    });
  });

  describe("authentication (deny-by-default)", () => {
    it("rejects an unauthenticated request to a protected route", async () => {
      await request(app.getHttpServer()).get("/api/v1/commissions").expect(401);
    });

    it("rejects a malformed token", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/commissions")
        .set("Authorization", "Bearer not-a-real-token")
        .expect(401);
    });
  });

  describe("authorization", () => {
    it("lets a Super Admin read the audit log", async () => {
      const token = await tokenFor(SUPER_ADMIN.id);
      const response = await request(app.getHttpServer())
        .get("/api/v1/audit")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({ total: 1 });
    });

    it("forbids a partner from reading the audit log", async () => {
      const token = await tokenFor(PARTNER_USER.id);
      await request(app.getHttpServer())
        .get("/api/v1/audit")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });

    it("forbids a partner from approving a commission", async () => {
      const token = await tokenFor(PARTNER_USER.id);
      await request(app.getHttpServer())
        .post("/api/v1/commissions/33333333-3333-4333-8333-333333333333/approve")
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "let me in" })
        .expect(403);
    });

    it("forbids a partner from reading another partner's commission", async () => {
      const token = await tokenFor(PARTNER_USER.id);
      await request(app.getHttpServer())
        .get("/api/v1/commissions/33333333-3333-4333-8333-333333333333")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });

    it("reports the resolved permissions for the principal", async () => {
      const token = await tokenFor(PARTNER_USER.id);
      const response = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(response.body.role).toBe("partner");
      expect(response.body.permissions).toContain("commission.view_own");
      expect(response.body.permissions).not.toContain("commission.approve");
    });
  });

  describe("validation", () => {
    it("rejects an invalid login payload with field-level issues", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: "not-an-email", password: "" })
        .expect(400);

      expect(response.body.message).toBe("Validation failed");
      expect(Array.isArray(response.body.issues)).toBe(true);
    });
  });
});
