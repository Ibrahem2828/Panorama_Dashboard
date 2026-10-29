import { describe, expect, it } from "vitest";

import { cleanDate, dateRangeParams, dateRangeProblem } from "@/features/printing/order-filters";
import { EMPTY_PRINTER_FORM, formatRelativeAge, parsePrinter, printerBody, printerFormProblems, relativeAge, wasDeactivated } from "@/features/printing/printers-rules";
import { displayServerMessage, fieldError, firstMessage, itemFieldErrors } from "@/features/printing/server-errors";
import { AppApiError } from "@/lib/api/errors";

describe("printer form", () => {
  it("needs a name and limits lengths", () => {
    expect(printerFormProblems(EMPTY_PRINTER_FORM)).toEqual({ name: "required" });
    expect(printerFormProblems({ ...EMPTY_PRINTER_FORM, name: "x".repeat(101) })).toEqual({ name: "tooLong" });
    expect(printerFormProblems({ ...EMPTY_PRINTER_FORM, name: "HP", notes: "n".repeat(501) })).toEqual({ notes: "tooLong" });
    expect(printerFormProblems({ ...EMPTY_PRINTER_FORM, name: " HP " })).toEqual({});
  });
  it("trims and never sends an inactive printer as the default", () => {
    expect(printerBody({ name: " HP ", station: " Shop ", notes: "", isActive: true, isDefault: true })).toEqual({ name: "HP", station: "Shop", notes: "", is_active: true, is_default: true });
    expect(printerBody({ name: "HP", station: "", notes: "", isActive: false, isDefault: true })).toMatchObject({ is_active: false, is_default: false });
  });
});

describe("parsePrinter", () => {
  it("coerces a row and drops one without an id", () => {
    expect(parsePrinter({ id: 3, name: "HP", is_default: true, online: true, last_status: "busy", last_detail: "x", jobs: { queued: 2, printing: "1", failed_24h: -4 } }))
      .toMatchObject({ id: 3, name: "HP", is_active: true, is_default: true, online: true, last_status: "busy", jobs: { queued: 2, printing: 1, failed_24h: 0 }, last_seen_at: null });
    expect(parsePrinter({ name: "x" })).toBeNull();
    expect(parsePrinter(null)).toBeNull();
  });
  it("recognises the deactivated-instead-of-deleted answer", () => {
    expect(wasDeactivated({ success: true, code: "PRINTER_DEACTIVATED" })).toBe(true);
    expect(wasDeactivated(null)).toBe(false);
  });
});

describe("relative last seen", () => {
  const now = Date.parse("2026-10-29T12:00:00Z");
  it("picks the unit", () => {
    expect(relativeAge("2026-10-29T11:59:30Z", now)).toEqual({ value: -30, unit: "second" });
    expect(relativeAge("2026-10-29T11:55:00Z", now)).toEqual({ value: -5, unit: "minute" });
    expect(relativeAge("2026-10-29T09:00:00Z", now)).toEqual({ value: -3, unit: "hour" });
    expect(relativeAge("2026-10-27T12:00:00Z", now)).toEqual({ value: -2, unit: "day" });
    expect(relativeAge(null, now)).toBeNull();
    expect(relativeAge("junk", now)).toBeNull();
  });
  it("formats in English", () => {
    expect(formatRelativeAge("2026-10-29T11:55:00Z", "en", now)).toBe("5 minutes ago");
  });
});

describe("order date filter", () => {
  it("accepts real days only", () => {
    expect(cleanDate("2026-10-29")).toBe("2026-10-29");
    expect(cleanDate("2026-02-30")).toBe("");
    expect(cleanDate("29/10/2026")).toBe("");
    expect(cleanDate(null)).toBe("");
  });
  it("sends both ends, or none when inverted", () => {
    expect(dateRangeParams("2026-10-01", "2026-10-29")).toEqual({ created_after: "2026-10-01", created_before: "2026-10-29" });
    expect(dateRangeParams("", "2026-10-29")).toEqual({ created_before: "2026-10-29" });
    expect(dateRangeProblem("2026-10-30", "2026-10-29")).toBe("order");
    expect(dateRangeParams("2026-10-30", "2026-10-29")).toEqual({});
  });
});

describe("server error helpers", () => {
  it("finds the first sentence and per-item field errors", () => {
    expect(firstMessage({ a: ["", "boom"] })).toBe("boom");
    const error = new AppApiError({ status: 400, errors: { name: ["taken"], items: [{}, { page_range: ["bad range"], pages_count: ["mismatch"] }] } });
    expect(fieldError(error, "name")).toBe("taken");
    expect(itemFieldErrors(error)).toEqual({ 1: { page_range: "bad range", pages_count: "mismatch" } });
    expect(itemFieldErrors(new Error("x"))).toEqual({});
  });
  it("shows an English server sentence in Arabic only as a fallback", () => {
    expect(displayServerMessage("bad", "ar", "fallback")).toBe("fallback");
    expect(displayServerMessage("نطاق خاطئ", "ar", "fallback")).toBe("نطاق خاطئ");
    expect(displayServerMessage("bad", "en", "fallback")).toBe("bad");
  });
});
