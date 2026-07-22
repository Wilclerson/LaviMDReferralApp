import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, normalizePagination } from "./pagination";

describe("normalizePagination", () => {
  it("applies defaults when given no input", () => {
    expect(normalizePagination()).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      limit: DEFAULT_PAGE_SIZE,
      offset: 0,
    });
  });

  it("computes offset from page and pageSize", () => {
    expect(normalizePagination({ page: 3, pageSize: 25 })).toEqual({
      page: 3,
      pageSize: 25,
      limit: 25,
      offset: 50,
    });
  });

  it("clamps page to a minimum of 1", () => {
    expect(normalizePagination({ page: 0 }).page).toBe(1);
    expect(normalizePagination({ page: -5 }).page).toBe(1);
  });

  it("clamps pageSize to the maximum", () => {
    expect(normalizePagination({ pageSize: 10_000 }).pageSize).toBe(MAX_PAGE_SIZE);
  });

  it("clamps pageSize to a minimum of 1", () => {
    expect(normalizePagination({ pageSize: 0 }).pageSize).toBe(1);
  });

  it("truncates fractional values", () => {
    expect(normalizePagination({ page: 2.9, pageSize: 15.7 })).toMatchObject({
      page: 2,
      pageSize: 15,
    });
  });

  it("falls back to defaults for non-finite values", () => {
    expect(normalizePagination({ page: Number.NaN, pageSize: Number.POSITIVE_INFINITY })).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      limit: DEFAULT_PAGE_SIZE,
      offset: 0,
    });
  });
});
