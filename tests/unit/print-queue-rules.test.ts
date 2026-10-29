import { describe, expect, it } from "vitest";

import { jobActions, stageTotals, summarizePrinters, type QueueJob } from "@/features/printing/print-queue-rules";
import { CATALOG_SECTIONS, resolveCopyFrom, resolveSection, resolveTab, tabHref } from "@/features/printing/printing-home-rules";

let nextId = 1;
const job = (over: Partial<QueueJob> = {}): QueueJob => ({
  id: nextId++, order_id: 1, item: 1, item_name: "a.pdf", status: "done", printer_name: "HP", sides_printed: 4, sheets: 2, error: "",
  created_at: "2026-10-29T10:00:00Z", ...over,
});

describe("jobActions", () => {
  it("offers open, done and failed while a job is active", () => {
    expect(jobActions("queued")).toEqual({ open: true, markDone: true, markFailed: true, retry: false });
    expect(jobActions("printing")).toEqual({ open: true, markDone: true, markFailed: true, retry: false });
  });
  it("offers a retry after a failure and a reprint after success", () => {
    expect(jobActions("failed")).toEqual({ open: true, markDone: false, markFailed: false, retry: true });
    expect(jobActions("done")).toEqual({ open: false, markDone: false, markFailed: false, retry: true });
  });
});

describe("stageTotals", () => {
  it("adds the statuses of each stage and treats a missing count as zero", () => {
    expect(stageTotals({ submitted: 2, under_review: 3, accepted: 1, printing: 4, ready: 5 })).toEqual({ new: 5, inProgress: 5, ready: 5 });
    expect(stageTotals({})).toEqual({ new: 0, inProgress: 0, ready: 0 });
  });
});

describe("summarizePrinters", () => {
  it("groups jobs by printer and counts outcomes and sheets of finished jobs", () => {
    const [hp, other] = summarizePrinters([
      job({ printer_name: "HP", status: "done", sheets: 5 }),
      job({ printer_name: "HP", status: "failed", error: "paper jam", created_at: "2026-10-29T11:00:00Z" }),
      job({ printer_name: "HP", status: "queued", created_at: "2026-10-29T12:00:00Z" }),
      job({ printer_name: "Canon", status: "done", sheets: 3, created_at: "2026-10-28T09:00:00Z" }),
    ]);
    expect(hp).toMatchObject({ name: "HP", jobs: 3, done: 1, failed: 1, active: 1, sheets: 5, lastStatus: "queued", lastError: "paper jam", needsAttention: false });
    expect(other).toMatchObject({ name: "Canon", jobs: 1, sheets: 3 });
  });
  it("flags a printer whose last three jobs all failed", () => {
    const failing = [1, 2, 3].map((n) => job({ printer_name: "Epson", status: "failed", created_at: `2026-10-29T0${n}:00:00Z` }));
    expect(summarizePrinters(failing)[0]?.needsAttention).toBe(true);
    expect(summarizePrinters([...failing.slice(0, 2), job({ printer_name: "Epson", created_at: "2026-10-29T09:00:00Z" })])[0]?.needsAttention).toBe(false);
  });
  it("puts jobs without a printer in their own last bucket and handles no jobs", () => {
    const result = summarizePrinters([job({ printer_name: "", created_at: "2026-10-30T00:00:00Z" }), job({ printer_name: "HP" })]);
    expect(result.map((entry) => entry.name)).toEqual(["HP", ""]);
    expect(summarizePrinters([])).toEqual([]);
  });
});

describe("printing workspace address", () => {
  it("falls back to the orders tab and the pricing section", () => {
    expect(resolveTab(null)).toBe("orders");
    expect(resolveTab("nonsense")).toBe("orders");
    expect(resolveTab("queue")).toBe("queue");
    expect(resolveSection("simulator")).toBe("simulator");
    expect(resolveSection("x")).toBe("pricing");
    expect(CATALOG_SECTIONS).toContain("simulator");
  });
  it("reads the order to copy only when it is a positive number", () => {
    expect(resolveCopyFrom("42")).toBe(42);
    for (const value of ["0", "-1", "abc", "", null, undefined, "1234567890"]) expect(resolveCopyFrom(value)).toBeNull();
  });
  it("builds a tab link carrying only its own parameters", () => {
    expect(tabHref("ar", "queue", { jstatus: "failed" })).toBe("/ar/dashboard/printing?tab=queue&jstatus=failed");
    expect(tabHref("en", "counter")).toBe("/en/dashboard/printing?tab=counter");
  });
});
