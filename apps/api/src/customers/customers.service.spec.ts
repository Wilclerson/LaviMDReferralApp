import type { RegisterCustomerInput } from "@lavimd/shared";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { CustomersService, maskEmail } from "./customers.service";

const VALID = {
  email: "person@example.com",
  password: "a-sufficiently-long-passphrase",
  consent: { version: "2026-07-01", terms: true, privacy: true },
} as const;

function setup(existingUser: unknown = null): {
  service: CustomersService;
  createUser: ReturnType<typeof vi.fn>;
  createConsents: ReturnType<typeof vi.fn>;
} {
  const createUser = vi.fn(() => Promise.resolve({ id: "u1" }));
  const createConsents = vi.fn(() => Promise.resolve({ count: 3 }));
  const prisma = {
    user: { findUnique: vi.fn(() => Promise.resolve(existingUser)) },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      Promise.resolve(
        fn({ user: { create: createUser }, consentRecord: { createMany: createConsents } }),
      ),
    ),
  } as unknown as PrismaService;
  return { service: new CustomersService(prisma), createUser, createConsents };
}

describe("maskEmail", () => {
  it("keeps logs free of full addresses", () => {
    expect(maskEmail("person@example.com")).toBe("p***@example.com");
    expect(maskEmail("garbage")).toBe("***");
  });
});

describe("CustomersService.register", () => {
  it("creates a customer with all three consent records", async () => {
    const { service, createUser, createConsents } = setup();
    const result = await service.register(VALID, { ip: "203.0.113.5", userAgent: "agent" });

    expect(result.created).toBe(true);
    expect(createUser).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "person@example.com", role: "customer" }),
    });

    const consents = createConsents.mock.calls[0]?.[0] as {
      data: { type: string; granted: boolean }[];
    };
    expect(consents.data.map((entry) => entry.type)).toEqual(["terms", "privacy", "marketing"]);
    expect(consents.data.find((entry) => entry.type === "marketing")?.granted).toBe(false);
  });

  it("normalizes the email before storing it", async () => {
    const { service, createUser } = setup();
    await service.register(
      { ...VALID, email: "  Mixed.Case@Example.COM " },
      {
        ip: null,
        userAgent: null,
      },
    );

    expect(createUser).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "mixed.case@example.com" }),
    });
  });

  it("does not create a duplicate account, and reports it only internally", async () => {
    const { service, createUser } = setup({ id: "existing" });
    const result = await service.register(VALID, { ip: null, userAgent: null });

    expect(result.created).toBe(false);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("refuses registration without the required consent", async () => {
    const { service, createUser } = setup();
    // terms/privacy are typed as literal `true`, so this can only come from an
    // untyped caller — exactly the boundary the schema is there to guard.
    const withoutConsent = {
      ...VALID,
      consent: { version: "v1", terms: false, privacy: true },
    } as unknown as RegisterCustomerInput;

    await expect(service.register(withoutConsent, { ip: null, userAgent: null })).rejects.toThrow();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("refuses a password below the minimum length", async () => {
    const { service } = setup();
    await expect(
      service.register({ ...VALID, password: "short" }, { ip: null, userAgent: null }),
    ).rejects.toThrow();
  });
});
