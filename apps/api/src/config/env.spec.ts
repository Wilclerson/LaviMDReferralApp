import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

const VALID = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  JWT_SECRET: "a".repeat(32),
};

describe("loadEnv", () => {
  it("applies defaults for optional values", () => {
    const env = loadEnv({ ...VALID } as NodeJS.ProcessEnv);
    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(3000);
    expect(env.JWT_EXPIRES_IN).toBe("1h");
  });

  it("coerces PORT to a number", () => {
    const env = loadEnv({ ...VALID, PORT: "8080" } as NodeJS.ProcessEnv);
    expect(env.PORT).toBe(8080);
  });

  it("rejects a short JWT secret", () => {
    expect(() => loadEnv({ ...VALID, JWT_SECRET: "too-short" } as NodeJS.ProcessEnv)).toThrow(
      /JWT_SECRET/,
    );
  });

  it("rejects a missing database url", () => {
    expect(() => loadEnv({ JWT_SECRET: "a".repeat(32) } as NodeJS.ProcessEnv)).toThrow(
      /DATABASE_URL/,
    );
  });
});
