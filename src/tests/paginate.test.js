import { describe, it, expect, vi } from "vitest";
import { parsePagination, paginateQuery } from "../utils/paginate.js";

// ─────────────────────────────────────────
// parsePagination — unit tests (no DB)
// ─────────────────────────────────────────
describe("parsePagination", () => {
  it("returns defaults when query is empty", () => {
    const { page, limit } = parsePagination({});
    expect(page).toBe(1);
    expect(limit).toBe(20);
  });

  it("parses valid page and limit", () => {
    const { page, limit } = parsePagination({ page: "3", limit: "50" });
    expect(page).toBe(3);
    expect(limit).toBe(50);
  });

  it("clamps page minimum to 1", () => {
    expect(parsePagination({ page: "0" }).page).toBe(1);
    expect(parsePagination({ page: "-5" }).page).toBe(1);
  });

  it("clamps limit maximum to 100", () => {
    expect(parsePagination({ limit: "999" }).limit).toBe(100);
  });

  it("clamps limit minimum to 1", () => {
    expect(parsePagination({ limit: "0" }).limit).toBe(1);
    expect(parsePagination({ limit: "-10" }).limit).toBe(1);
  });

  it("handles non-numeric strings gracefully", () => {
    const { page, limit } = parsePagination({ page: "abc", limit: "xyz" });
    expect(page).toBe(1);
    expect(limit).toBe(20);
  });
});

// ─────────────────────────────────────────
// paginateQuery — unit tests (mocked model)
// ─────────────────────────────────────────
describe("paginateQuery", () => {
  function mockModel(total, rows) {
    return {
      count:    vi.fn().mockResolvedValue(total),
      findMany: vi.fn().mockResolvedValue(rows),
    };
  }

  it("returns data and pagination envelope", async () => {
    const rows  = [{ id: "a" }, { id: "b" }];
    const model = mockModel(45, rows);

    const result = await paginateQuery(model, { page: 2, limit: 10 });

    expect(result.data).toEqual(rows);
    expect(result.pagination).toMatchObject({
      total: 45, page: 2, limit: 10, totalPages: 5,
      hasNext: true, hasPrev: true,
    });
  });

  it("passes correct skip to findMany", async () => {
    const model = mockModel(100, []);
    await paginateQuery(model, { page: 4, limit: 10 });
    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 30, take: 10 })
    );
  });

  it("hasNext false on last page", async () => {
    const model  = mockModel(20, []);
    const result = await paginateQuery(model, { page: 2, limit: 10 });
    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrev).toBe(true);
  });

  it("hasPrev false on first page", async () => {
    const model  = mockModel(20, []);
    const result = await paginateQuery(model, { page: 1, limit: 10 });
    expect(result.pagination.hasPrev).toBe(false);
  });

  it("handles empty result set", async () => {
    const model  = mockModel(0, []);
    const result = await paginateQuery(model, { page: 1, limit: 20 });
    expect(result.data).toEqual([]);
    expect(result.pagination.totalPages).toBe(0);
    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrev).toBe(false);
  });

  it("runs count and findMany in parallel — each called exactly once", async () => {
    const model = mockModel(5, [{ id: "x" }]);
    await paginateQuery(model, { page: 1, limit: 20 });
    expect(model.count).toHaveBeenCalledTimes(1);
    expect(model.findMany).toHaveBeenCalledTimes(1);
  });
});
