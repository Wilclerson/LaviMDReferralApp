import { UnauthorizedException } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import { hash } from "bcryptjs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { AuthService, hashPassword } from "./auth.service";

let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hash("correct-horse", 4);
});

const jwtService = {
  signAsync: vi.fn(() => Promise.resolve("signed.jwt.token")),
} as unknown as JwtService;

function prismaWith(user: unknown): PrismaService {
  return { user: { findUnique: vi.fn(() => Promise.resolve(user)) } } as unknown as PrismaService;
}

describe("AuthService.login", () => {
  it("issues a token for valid credentials", async () => {
    const service = new AuthService(
      prismaWith({ id: "u1", passwordHash, isActive: true }),
      jwtService,
    );
    await expect(
      service.login({ email: "a@example.com", password: "correct-horse" }),
    ).resolves.toEqual({ accessToken: "signed.jwt.token" });
  });

  it("rejects an unknown email with a generic error", async () => {
    const service = new AuthService(prismaWith(null), jwtService);
    await expect(
      service.login({ email: "nobody@example.com", password: "whatever" }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a wrong password", async () => {
    const service = new AuthService(
      prismaWith({ id: "u1", passwordHash, isActive: true }),
      jwtService,
    );
    await expect(service.login({ email: "a@example.com", password: "wrong" })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("rejects a deactivated account", async () => {
    const service = new AuthService(
      prismaWith({ id: "u1", passwordHash, isActive: false }),
      jwtService,
    );
    await expect(
      service.login({ email: "a@example.com", password: "correct-horse" }),
    ).rejects.toThrow(UnauthorizedException);
  });
});

describe("hashPassword", () => {
  it("produces a verifiable, salted hash", async () => {
    const first = await hashPassword("s3cret-passphrase");
    const second = await hashPassword("s3cret-passphrase");
    expect(first).not.toBe(second);
    expect(first.startsWith("$2")).toBe(true);
  }, 20_000);
});
