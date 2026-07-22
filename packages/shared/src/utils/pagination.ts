export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
  offset: number;
  limit: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Normalizes untrusted pagination input into safe, clamped values.
 *
 * - `page` is clamped to >= 1 and truncated to an integer.
 * - `pageSize` is clamped to the inclusive range [1, {@link MAX_PAGE_SIZE}].
 * - Non-finite or missing values fall back to defaults.
 */
export function normalizePagination(input: PaginationInput = {}): Pagination {
  const page = clampInt(input.page, 1, Number.MAX_SAFE_INTEGER, 1);
  const pageSize = clampInt(input.pageSize, 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
  return {
    page,
    pageSize,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  const truncated = Math.trunc(value);
  return Math.min(max, Math.max(min, truncated));
}
