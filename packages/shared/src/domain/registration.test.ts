import { describe, expect, it } from "vitest";
import { consentSchema, PASSWORD_MIN_LENGTH, registerCustomerSchema } from "./registration";

const VALID = {
  email: "customer@example.com",
  password: "a-sufficiently-long-passphrase",
  consent: { version: "2026-07-01", terms: true, privacy: true },
};

describe("consentSchema", () => {
  it("defaults marketing consent to opted-out", () => {
    const parsed = consentSchema.parse({ version: "v1", terms: true, privacy: true });
    expect(parsed.marketing).toBe(false);
  });

  it("requires terms consent", () => {
    expect(consentSchema.safeParse({ version: "v1", terms: false, privacy: true }).success).toBe(
      false,
    );
  });

  it("requires privacy consent", () => {
    expect(consentSchema.safeParse({ version: "v1", terms: true, privacy: false }).success).toBe(
      false,
    );
  });

  it("requires a policy version", () => {
    expect(consentSchema.safeParse({ version: "", terms: true, privacy: true }).success).toBe(
      false,
    );
  });
});

describe("registerCustomerSchema", () => {
  it("accepts a valid registration", () => {
    expect(registerCustomerSchema.safeParse(VALID).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(registerCustomerSchema.safeParse({ ...VALID, email: "nope" }).success).toBe(false);
  });

  it("trims and lower-cases the email so uniqueness holds", () => {
    const parsed = registerCustomerSchema.parse({ ...VALID, email: "  Mixed.Case@Example.COM " });
    expect(parsed.email).toBe("mixed.case@example.com");
  });

  it("rejects a password shorter than the minimum", () => {
    expect(
      registerCustomerSchema.safeParse({ ...VALID, password: "a".repeat(PASSWORD_MIN_LENGTH - 1) })
        .success,
    ).toBe(false);
  });

  it("rejects a password that is mostly whitespace", () => {
    expect(
      registerCustomerSchema.safeParse({ ...VALID, password: `  ${" ".repeat(20)}  ` }).success,
    ).toBe(false);
  });

  it("rejects registration without consent", () => {
    expect(
      registerCustomerSchema.safeParse({ email: VALID.email, password: VALID.password }).success,
    ).toBe(false);
  });
});
