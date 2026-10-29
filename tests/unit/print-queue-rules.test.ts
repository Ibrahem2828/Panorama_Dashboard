import { describe, expect, it } from "vitest";

import { COUNTED_JOB_STATUSES, jobActions, stageTotals } from "@/features/printing/print-queue-rules";
import { CATALOG_SECTIONS, resolveCopyFrom, resolveSection, resolveTab, tabHref } from "@/features/printing/printing-home-rules";

describe("jobActions", () => {
  it("offers open, done and failed while a job is active", () => {
    expect(jobActions("queued")).toEqual({ open: true, markDone: true, markFailed: true, retry: false, cancel: true });
    expect(jobActions("printing")).toEqual({ open: true, markDone: true, markFailed: true, retry: false, cancel: true });
  });
  it("offers a retry after a failure and a reprint after success", () => {
    expect(jobActions("failed")).toEqual({ open: true, markDone: false, markFailed: false, retry: true, cancel: false });
    expect(jobActions("done")).toEqual({ open: false, markDone: false, markFailed: false, retry: true, cancel: false });
  });
});

describe("cancelled jobs", () => {
  it("are final: no open, retry or cancel", () => {
    expect(jobActions("cancelled")).toEqual({ open: false, markDone: false, markFailed: false, retry: false, cancel: false });
  });
  it("the strip never counts them", () => {
    expect(COUNTED_JOB_STATUSES).not.toContain("cancelled");
  });
});

describe("stageTotals", () => {
  it("adds the statuses of each stage and treats a missing count as zero", () => {
    expect(stageTotals({ submitted: 2, under_review: 3, accepted: 1, printing: 4, ready: 5 })).toEqual({ new: 5, inProgress: 5, ready: 5 });
    expect(stageTotals({})).toEqual({ new: 0, inProgress: 0, ready: 0 });
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
