import { describe, expect, it } from "vitest";

import { buildPreview, countLabel, MAX_VISIBLE_COPIES, parseOrderItems, prepProgress, spiralRingCount, summarizePrep } from "@/features/printing/print-order-rules";

const row = (over: Record<string, unknown> = {}) => ({
  id: 1, original_file_name: "lecture.pdf", copies: 2, pages_count: 20, sheets_count: 20,
  color_mode: "black_white", paper_size: "A4", sides: "double_sided", binding: "spiral", price: "250.00", ...over,
});

describe("parseOrderItems", () => {
  it("reads a normal API row", () => {
    expect(parseOrderItems([row()])).toEqual([{
      id: 1, fileName: "lecture.pdf", copies: 2, pages: 20, sheets: 20, colorMode: "black_white", paperSize: "A4", sides: "double_sided", binding: "spiral", price: "250.00",
    }]);
  });
  it("is empty for anything that is not a list", () => {
    for (const value of [undefined, null, "x", 5, {}]) expect(parseOrderItems(value)).toEqual([]);
  });
  it("skips non-objects and falls back to safe defaults for unknown or missing values", () => {
    const [item, ...rest] = parseOrderItems([null, 3, { id: "a", copies: 0, color_mode: "neon", paper_size: "B5", sides: 7, binding: "glue" }]);
    expect(rest).toHaveLength(0);
    expect(item).toMatchObject({ id: "a", copies: 1, pages: null, sheets: null, colorMode: "black_white", paperSize: "A4", sides: "one_sided", binding: "none", price: null, fileName: "" });
  });
  it("uses the library title when there is no upload name, and numeric strings for counts", () => {
    expect(parseOrderItems([row({ original_file_name: "", source_file_title: "محاضرة 3", pages_count: "12", sheets_count: -4 })])[0]).toMatchObject({ fileName: "محاضرة 3", pages: 12, sheets: null });
  });
  it("gives rows without an id a stable fallback", () => {
    expect(parseOrderItems([{ copies: 1 }, { copies: 1 }]).map((item) => item.id)).toEqual(["row-0", "row-1"]);
  });
});

describe("buildPreview", () => {
  const base = { paperSize: "A4", colorMode: "black_white", sides: "one_sided", binding: "none", copies: 1 } as const;
  it("keeps the true proportions between sizes and the A-series shape", () => {
    const a5 = buildPreview({ ...base, paperSize: "A5" });
    const a4 = buildPreview(base);
    const a3 = buildPreview({ ...base, paperSize: "A3" });
    expect(a5.sheetWidth).toBeLessThan(a4.sheetWidth);
    expect(a4.sheetWidth).toBeLessThan(a3.sheetWidth);
    expect(a4.sheetHeight / a4.sheetWidth).toBeCloseTo(Math.SQRT2, 1);
  });
  it("stacks one sheet per extra copy up to the cap", () => {
    expect(buildPreview(base).stackDepth).toBe(0);
    expect(buildPreview({ ...base, copies: 3 }).stackDepth).toBe(2);
    expect(buildPreview({ ...base, copies: 50 }).stackDepth).toBe(MAX_VISIBLE_COPIES - 1);
    expect(buildPreview({ ...base, copies: 0 }).stackDepth).toBe(0);
  });
  it("maps colour and sides, and draws more coil loops on a taller sheet", () => {
    expect(buildPreview({ ...base, colorMode: "color", sides: "double_sided" })).toMatchObject({ colored: true, doubleSided: true });
    expect(spiralRingCount(40)).toBe(4);
    expect(spiralRingCount(180)).toBeGreaterThan(spiralRingCount(90));
  });
});

describe("summarizePrep", () => {
  it("adds sheets per paper size and ink, and one bound unit per copy", () => {
    const items = parseOrderItems([
      row({ id: 1, copies: 2, sheets_count: 20 }),
      row({ id: 2, copies: 1, sheets_count: 10, binding: "spiral" }),
      row({ id: 3, copies: 3, sheets_count: 9, color_mode: "color", paper_size: "A3", binding: "staple" }),
      row({ id: 4, copies: 1, sheets_count: 4, binding: "none" }),
    ]);
    const prep = summarizePrep(items);
    expect(prep.paper).toEqual([
      { paperSize: "A3", colorMode: "color", sheets: 9 },
      { paperSize: "A4", colorMode: "black_white", sheets: 34 },
    ]);
    expect(prep.bindings).toEqual([{ binding: "spiral", units: 3 }, { binding: "staple", units: 3 }]);
    expect(prep.totalSheets).toBe(43);
    expect(prep.totalCopies).toBe(7);
    expect(prep.incomplete).toBe(false);
  });
  it("flags items without a sheet count instead of guessing", () => {
    const prep = summarizePrep(parseOrderItems([row({ sheets_count: null }), row({ id: 2, sheets_count: 5 })]));
    expect(prep.incomplete).toBe(true);
    expect(prep.totalSheets).toBe(5);
  });
  it("is empty for no items", () => {
    expect(summarizePrep([])).toEqual({ paper: [], bindings: [], totalSheets: 0, totalCopies: 0, incomplete: false });
  });
});

describe("prepProgress", () => {
  const items = parseOrderItems([row({ id: 1 }), row({ id: 2 })]);
  it("counts only ticks that belong to this order", () => {
    expect(prepProgress(items, new Set(["1", "99"]))).toEqual({ done: 1, total: 2 });
    expect(prepProgress(items, new Set(["1", "2"]))).toEqual({ done: 2, total: 2 });
    expect(prepProgress([], new Set(["1"]))).toEqual({ done: 0, total: 0 });
  });
});

describe("countLabel", () => {
  it("uses the six Arabic plural forms", () => {
    expect(countLabel("ar", 1, "pages")).toBe("1 صفحة");
    expect(countLabel("ar", 2, "pages")).toBe("2 صفحتان");
    expect(countLabel("ar", 6, "pages")).toBe("6 صفحات");
    expect(countLabel("ar", 12, "pages")).toBe("12 صفحة");
    expect(countLabel("ar", 100, "sheets")).toBe("100 ورقة");
    expect(countLabel("ar", 3, "copies")).toBe("3 نسخ");
    expect(countLabel("ar", 2, "bound")).toBe("2 نسختان مجلّدتان");
  });
  it("uses one/other in English and treats unknown locales as English", () => {
    expect(countLabel("en", 1, "copies")).toBe("1 copy");
    expect(countLabel("en", 4, "sheets")).toBe("4 sheets");
    expect(countLabel("fr", 2, "pages")).toBe("2 pages");
  });
});
