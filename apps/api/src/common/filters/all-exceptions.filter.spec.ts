import { BadRequestException, ForbiddenException, HttpStatus } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { executionContext } from "../../../test/support/mocks";
import { AllExceptionsFilter } from "./all-exceptions.filter";

function responseSpy(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { status, json };
}

describe("AllExceptionsFilter", () => {
  it("passes through an HttpException with an object body", () => {
    const filter = new AllExceptionsFilter();
    const res = responseSpy();
    const ctx = executionContext({ headers: {}, url: "/api/v1/x", method: "POST" }, res);

    filter.catch(new BadRequestException({ message: "Validation failed" }), ctx);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: "Validation failed", path: "/api/v1/x" }),
    );
  });

  it("passes through an HttpException with a string body", () => {
    const filter = new AllExceptionsFilter();
    const res = responseSpy();
    const ctx = executionContext({ headers: {}, url: "/api/v1/y", method: "GET" }, res);

    filter.catch(new ForbiddenException("Insufficient permissions"), ctx);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, message: "Insufficient permissions" }),
    );
  });

  it("never leaks details of an unexpected error", () => {
    const filter = new AllExceptionsFilter();
    const res = responseSpy();
    const ctx = executionContext({ headers: {}, url: "/api/v1/z", method: "GET" }, res);

    filter.catch(new Error("connection string leaked here"), ctx);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: "Internal server error" }),
    );
    expect(JSON.stringify(res.json.mock.calls)).not.toContain("connection string");
  });

  it("handles a non-Error throwable", () => {
    const filter = new AllExceptionsFilter();
    const res = responseSpy();
    const ctx = executionContext({ headers: {}, url: "/api/v1/z", method: "GET" }, res);

    filter.catch("boom", ctx);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
