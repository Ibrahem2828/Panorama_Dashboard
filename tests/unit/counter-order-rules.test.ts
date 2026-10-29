import { describe, expect, it } from "vitest";

import {
  amountProblem, createBody, defaultPaid, itemBody, lineIsValid, lineProblems, lineSheets, linesFromOrderItems, newLine, nextStatus, orderIsReady, pageRangeCount, paidProblem, parseCounterQuote,
  quoteBody, signedRounding, wholeNumber, type CounterLine, type CounterOrderInput,
} from "@/features/printing/counter-order-rules";

const line = (over: Partial<CounterLine> = {}): CounterLine => ({ ...newLine(), pages: "10", copies: "2", ...over });

describe("wholeNumber", () => {
  it("accepts positive whole numbers within the limit", () => {
    expect(wholeNumber("10", 99)).toBe(10);
    expect(wholeNumber(" 7 ", 99)).toBe(7);
    expect(wholeNumber("99", 99)).toBe(99);
  });
  it("rejects empty, zero, decimals, signs and values over the limit", () => {
    for (const text of ["", "0", "1.5", "-3", "abc", "100", "٣"]) expect(wholeNumber(text, 99)).toBeNull();
  });
});

describe("lines", () => {
  it("a new line has the usual shop defaults and a unique key", () => {
    const first = newLine();
    const second = newLine();
    expect(first.key).not.toBe(second.key);
    expect(first).toMatchObject({ copies: "1", colorMode: "black_white", paperSize: "A4", sides: "one_sided", binding: "none", pages: "" });
  });
  it("needs pages and copies, and a description for an 'other' binding", () => {
    expect(lineProblems(newLine())).toEqual({ pages: true });
    expect(lineProblems(line({ copies: "0" }))).toEqual({ copies: true });
    expect(lineProblems(line({ binding: "other", bindingNote: "  " }))).toEqual({ bindingNote: true });
    expect(lineIsValid(line({ binding: "other", bindingNote: "metal clip" }))).toBe(true);
    expect(lineIsValid(line())).toBe(true);
  });
  it("counts physical sheets: a double-sided sheet carries two pages", () => {
    expect(lineSheets(line())).toBe(20);
    expect(lineSheets(line({ sides: "double_sided", pages: "11" }))).toBe(12);
    expect(lineSheets(line({ pages: "" }))).toBeNull();
  });
  it("builds the request items with only what the server needs", () => {
    expect(itemBody(line({ title: " lecture ", binding: "spiral" }))).toEqual({
      pages_count: 10, copies: 2, color_mode: "black_white", paper_size: "A4", sides: "one_sided", binding: "spiral", title: "lecture",
    });
    expect(itemBody(line({ binding: "other", bindingNote: " clip " }))).toMatchObject({ binding: "other", binding_note: "clip" });
    expect(itemBody(line({ binding: "spiral", bindingNote: "ignored" }))).not.toHaveProperty("binding_note");
    expect(quoteBody([line()], "USD")).toMatchObject({ currency: "USD", items: [{ pages_count: 10 }] });
  });
});

describe("parseCounterQuote", () => {
  it("reads a complete quote with the rounding", () => {
    const quote = parseCounterQuote({
      complete: true, exact_total: "224", suggested_total: 230, rounding_adjustment: "6.00",
      items: [{ pages_count: 10, sheets_count: 20, subtotal: "224.00", unavailable: null }],
    });
    expect(quote).toEqual({ complete: true, exactTotal: "224.00", suggestedTotal: "230.00", rounding: "6.00", lines: [{ pages: 10, sheets: 20, subtotal: "224.00", unitPrice: null, bindingPrice: null, unavailable: null }] });
  });
  it("keeps an unpriced line unpriced instead of turning it into zero", () => {
    const quote = parseCounterQuote({
      complete: false, exact_total: "100", suggested_total: null, rounding_adjustment: null,
      items: [{ pages_count: 3, sheets_count: 3, subtotal: null, unavailable: "binding" }, { pages_count: 1, sheets_count: 1, subtotal: "100", unavailable: "weird" }],
    });
    expect(quote?.complete).toBe(false);
    expect(quote?.suggestedTotal).toBeNull();
    expect(quote?.lines[0]).toMatchObject({ subtotal: null, unavailable: "binding" });
    expect(quote?.lines[1]?.unavailable).toBeNull();
  });
  it("is null for anything that is not a quote", () => {
    for (const value of [null, undefined, "x", 3, {}, { items: "no" }]) expect(parseCounterQuote(value)).toBeNull();
  });
});

describe("amounts", () => {
  it("validates a price: required, numeric, at most two decimals", () => {
    expect(amountProblem("")).toBe("required");
    expect(amountProblem("  ")).toBe("required");
    expect(amountProblem("12a")).toBe("invalid");
    expect(amountProblem("-5")).toBe("invalid");
    expect(amountProblem("1.234")).toBe("tooMany");
    expect(amountProblem("0")).toBeNull();
    expect(amountProblem("150")).toBeNull();
    expect(amountProblem("1.25")).toBeNull();
    expect(amountProblem("", true)).toBeNull();
  });
  it("by default the customer pays everything when the order is delivered, nothing otherwise", () => {
    expect(defaultPaid("delivered", "230")).toBe("230.00");
    expect(defaultPaid("printing", "230")).toBe("0");
    expect(defaultPaid("ready", "230")).toBe("0");
    expect(defaultPaid("delivered", "")).toBe("0");
  });
  it("the amount received can never be more than the price", () => {
    expect(paidProblem("100", "200")).toBeNull();
    expect(paidProblem("200", "200")).toBeNull();
    expect(paidProblem("200.01", "200")).toBe("exceeds");
    expect(paidProblem("", "200")).toBe("required");
    expect(paidProblem("0", "0")).toBeNull();
  });
  it("shows the rounding as a signed whole amount, and nothing when there is none", () => {
    expect(signedRounding("6.00")).toBe("+6");
    expect(signedRounding("-4.00")).toBe("-4");
    expect(signedRounding("0.50")).toBe("+0.50");
    expect(signedRounding("0.00")).toBeNull();
    expect(signedRounding(null)).toBeNull();
  });
});

describe("the whole order", () => {
  const base: CounterOrderInput = {
    lines: [line({ title: "lecture", binding: "spiral" })], currency: "SYP", customerName: " سلمى ", customerPhone: " 0944 ",
    price: "230", paid: "230", method: "cash", status: "delivered", notes: " careful ",
  };
  it("is ready when the lines, the price and the payment are valid", () => {
    expect(orderIsReady(base)).toBe(true);
    expect(orderIsReady({ ...base, lines: [] })).toBe(false);
    expect(orderIsReady({ ...base, lines: [newLine()] })).toBe(false);
    expect(orderIsReady({ ...base, price: "" })).toBe(false);
    expect(orderIsReady({ ...base, paid: "231" })).toBe(false);
  });
  it("builds the create request with normalised amounts and trimmed text", () => {
    expect(createBody(base)).toMatchObject({
      total_price: "230.00", paid_amount: "230.00", status: "delivered", payment_method: "cash", currency: "SYP",
      customer_name: "سلمى", customer_phone: "0944", internal_notes: "careful",
    });
    const bare = createBody({ ...base, customerName: "", customerPhone: "", notes: "" });
    expect(bare).not.toHaveProperty("customer_name");
    expect(bare).not.toHaveProperty("customer_phone");
    expect(bare).not.toHaveProperty("internal_notes");
  });
  it("moves an order on along the normal print flow", () => {
    expect(nextStatus("submitted")).toBe("under_review");
    expect(nextStatus("accepted")).toBe("printing");
    expect(nextStatus("printing")).toBe("ready");
    expect(nextStatus("ready")).toBe("delivered");
    expect(nextStatus("delivered")).toBeNull();
    expect(nextStatus("cancelled")).toBeNull();
  });
});

describe("pages per sheet (N-up) and cover", () => {
  it("counts fewer sheets when several pages share a face", () => {
    expect(lineSheets(line({ pages: "10", copies: "1", pagesPerSheet: 4 }))).toBe(3);
    expect(lineSheets(line({ pages: "10", copies: "2", pagesPerSheet: 4, sides: "double_sided" }))).toBe(4);
    expect(lineSheets(line({ pages: "1", copies: "1", pagesPerSheet: 16 }))).toBe(1);
  });
  it("ignores a pages-per-sheet value the server does not accept", () => {
    expect(lineSheets(line({ pages: "10", copies: "1", pagesPerSheet: 5 }))).toBe(10);
    expect(itemBody(line({ pagesPerSheet: 5 }))).not.toHaveProperty("pages_per_sheet");
  });
  it("sends pages_per_sheet and cover only when chosen", () => {
    expect(itemBody(line())).not.toHaveProperty("pages_per_sheet");
    expect(itemBody(line())).not.toHaveProperty("cover");
    expect(itemBody(line({ pagesPerSheet: 6, cover: "blue" }))).toMatchObject({ pages_per_sheet: 6, cover: "blue" });
    expect(itemBody(line({ docPages: "50", pageRange: "1-5" }))).not.toHaveProperty("page_range");
  });
});

describe("pageRangeCount", () => {
  it("counts the whole document for an empty range", () => {
    expect(pageRangeCount("", 40)).toEqual({ count: 40 });
    expect(pageRangeCount("   ", 40)).toEqual({ count: 40 });
  });
  it("counts ranges and single pages once each, accepting Arabic commas and dashes", () => {
    expect(pageRangeCount("1-5, 8", 20)).toEqual({ count: 6 });
    expect(pageRangeCount("1-5، 3-7", 20)).toEqual({ count: 7 });
    expect(pageRangeCount("2–4;9", 20)).toEqual({ count: 4 });
  });
  it("explains what is wrong", () => {
    expect(pageRangeCount("a-b", 20)).toEqual({ error: "format" });
    expect(pageRangeCount("5-2", 20)).toEqual({ error: "order" });
    expect(pageRangeCount("0-2", 20)).toEqual({ error: "order" });
    expect(pageRangeCount("1-21", 20)).toEqual({ error: "beyond" });
    expect(pageRangeCount(",", 20)).toEqual({ error: "empty" });
    expect(pageRangeCount("1-2", 0)).toEqual({ error: "docPages" });
  });
});

describe("linesFromOrderItems (copy an order into the counter)", () => {
  it("carries over the printed pages and every option the counter supports", () => {
    const [first] = linesFromOrderItems([{
      original_file_name: "notes.pdf", pages_count: 100, selected_pages: 40, copies: 3, color_mode: "color", paper_size: "A3", sides: "double_sided",
      binding: "spiral", binding_note: "", pages_per_sheet: 4, cover: "blue",
    }]);
    expect(first).toMatchObject({ title: "notes.pdf", pages: "40", copies: "3", colorMode: "color", paperSize: "A3", sides: "double_sided", binding: "spiral", pagesPerSheet: 4, cover: "blue", productId: null });
  });
  it("falls back to the page count, and to safe defaults for odd data", () => {
    const [first] = linesFromOrderItems([{ pages_count: "12", copies: 500, paper_size: "B5", binding: "bad code!", pages_per_sheet: 7 }]);
    expect(first).toMatchObject({ pages: "12", copies: "99", paperSize: "A4", binding: "none", pagesPerSheet: 1, colorMode: "black_white", sides: "one_sided" });
  });
  it("turns a ready product into a product line", () => {
    const [first] = linesFromOrderItems([{ product: 7, original_file_name: "Notebook", copies: 2 }]);
    expect(first).toMatchObject({ productId: 7, productName: "Notebook", copies: "2" });
  });
  it("gives every line its own key, caps the lines and ignores junk", () => {
    const many = Array.from({ length: 30 }, () => ({ pages_count: 1, copies: 1 }));
    const lines = linesFromOrderItems([null, "x", ...many]);
    expect(lines).toHaveLength(20);
    expect(new Set(lines.map((entry) => entry.key)).size).toBe(20);
    expect(linesFromOrderItems("nope")).toEqual([]);
  });
});
