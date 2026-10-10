import { describe, expect, it } from "vitest";

import { normalizeCollection } from "@/lib/api/browser-client";

describe("normalizeCollection", () => {
  const rows = [{ id: 1 }, { id: 2 }];

  it("reads the backend envelope with a paginated data object (the real list shape)", async () => {
    const page = await normalizeCollection<{ id: number }>({ success: true, code: "OK", data: { count: 42, next: "n", previous: null, results: rows } });
    expect(page.results).toEqual(rows);
    expect(page.count).toBe(42);
    expect(page.next).toBe("n");
  });

  it("reads a bare page object, an array, and a data array", async () => {
    expect((await normalizeCollection({ count: 2, results: rows })).results).toEqual(rows);
    expect((await normalizeCollection(rows)).count).toBe(2);
    expect((await normalizeCollection({ data: rows })).results).toEqual(rows);
  });

  it("returns an empty page for anything else", async () => {
    expect(await normalizeCollection(null)).toEqual({ results: [], count: 0, next: null, previous: null });
    expect((await normalizeCollection({ data: { detail: "x" } })).results).toEqual([]);
  });

  it("parses a raw fetch Response, which is what apiFetch returns", async () => {
    const response = new Response(JSON.stringify({ success: true, data: { count: 2, results: rows } }), { headers: { "content-type": "application/json" } });
    const page = await normalizeCollection<{ id: number }>(response);
    expect(page.results).toEqual(rows);
    expect(page.count).toBe(2);
  });

  it("also accepts a promise of a Response", async () => {
    const page = await normalizeCollection<{ id: number }>(Promise.resolve(new Response(JSON.stringify({ data: { results: rows } }))));
    expect(page.results).toHaveLength(2);
  });
});
