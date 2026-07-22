import type { Request } from "express";
import { describe, expect, it } from "vitest";
import { clientIp } from "./client-ip";

const req = (headers: Record<string, unknown>, ip?: string): Pick<Request, "ip" | "headers"> =>
  ({ headers, ip }) as unknown as Pick<Request, "ip" | "headers">;

describe("clientIp", () => {
  it("prefers the first x-forwarded-for entry", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }, "10.0.0.2"))).toBe(
      "203.0.113.7",
    );
  });

  it("falls back to the socket ip", () => {
    expect(clientIp(req({}, "198.51.100.4"))).toBe("198.51.100.4");
  });

  it("returns null when nothing is available", () => {
    expect(clientIp(req({}))).toBeNull();
  });

  it("ignores an empty forwarded header", () => {
    expect(clientIp(req({ "x-forwarded-for": "" }, "198.51.100.4"))).toBe("198.51.100.4");
  });

  it("ignores a forwarded header that is only separators", () => {
    expect(clientIp(req({ "x-forwarded-for": " , " }, "198.51.100.4"))).toBe("198.51.100.4");
  });

  it("truncates absurdly long values", () => {
    expect(clientIp(req({}, "9".repeat(80)))?.length).toBe(45);
  });
});
