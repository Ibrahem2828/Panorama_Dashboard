import { describe, expect, it } from "vitest";

import {
  currentExchangeRate, customRangeProblem, dueAmount, expenseTotals, formatMoney, formatRate, groupByCategory, isSettled, missingRateForTotals, movementBody,
  parseJobTotals, parseSummary, paymentAmountProblem, paymentBody, paymentState, periodRange, quantityAfter, signedAdjustment,
} from "@/features/finance/finance-rules";
import { permissionOverridePath } from "@/features/rbac/override-path";
import { parseField, type FieldSpec } from "@/features/resources/form-schema";

describe("period ranges", () => {
  const wednesday = new Date(2026, 9, 14, 15, 30); // Wed 14 Oct 2026
  it("today is one day", () => expect(periodRange("today", wednesday)).toEqual({ from: "2026-10-14", to: "2026-10-14" }));
  it("the week starts on Sunday", () => expect(periodRange("week", wednesday)).toEqual({ from: "2026-10-11", to: "2026-10-14" }));
  it("the week crosses a month boundary", () => expect(periodRange("week", new Date(2026, 10, 2))).toEqual({ from: "2026-11-01", to: "2026-11-02" }));
  it("the month starts on the 1st", () => expect(periodRange("month", wednesday)).toEqual({ from: "2026-10-01", to: "2026-10-14" }));
  it("a custom range is passed through and validated", () => {
    expect(periodRange("custom", wednesday, { from: "2026-01-01", to: "2026-01-31" })).toEqual({ from: "2026-01-01", to: "2026-01-31" });
    expect(customRangeProblem("", "2026-01-31")).toBe("incomplete");
    expect(customRangeProblem("2026-02-01", "2026-01-31")).toBe("order");
    expect(customRangeProblem("2026-01-01", "2026-01-01")).toBeNull();
  });
});

describe("currency formatting", () => {
  it("uses Western digits, grouping and the right symbol", () => {
    expect(formatMoney("1250000", "SYP", "ar")).toBe("1,250,000 ل.س");
    expect(formatMoney("12.5", "USD", "ar")).toBe("$12.50");
    expect(formatMoney("0", "SYP", "ar")).toBe("0 ل.س");
  });
  it("never shows Arabic-Indic digits", () => expect(formatMoney("1234.5", "SYP", "ar")).not.toMatch(/[٠-٩]/u));
  it("is a dash for a non-number", () => {
    expect(formatMoney(null, "SYP")).toBe("—");
    expect(formatMoney("abc", "USD")).toBe("—");
  });
  it("keeps up to four places for a rate", () => expect(formatRate("13250.5", "ar")).toBe("13,250.5"));
});

describe("due amount and payment state", () => {
  it("subtracts in minor units without float error", () => {
    expect(dueAmount("0.30", "0.10")).toBe("0.20");
    expect(dueAmount("100", "25.50")).toBe("74.50");
  });
  it("never goes below zero", () => expect(dueAmount("10", "12")).toBe("0.00"));
  it("states", () => {
    expect(paymentState("100", "0")).toBe("unpaid");
    expect(paymentState("100", "40")).toBe("partial");
    expect(paymentState("100", "100")).toBe("paid");
    expect(isSettled("0", "0")).toBe(true);
  });
  it("validates a payment amount", () => {
    expect(paymentAmountProblem("", "10")).toBe("invalid");
    expect(paymentAmountProblem("0", "10")).toBe("invalid");
    expect(paymentAmountProblem("-5", "10")).toBe("invalid");
    expect(paymentAmountProblem("1.005", "10")).toBe("tooMany");
    expect(paymentAmountProblem("10.01", "10.00")).toBe("exceeds");
    expect(paymentAmountProblem("10", "10.00")).toBeNull();
  });
  it("builds the request body", () => expect(paymentBody("7", " 12.50 ", "cash", " ")).toEqual({ order: 7, amount: "12.50", method: "cash" }));
});

describe("stock helpers", () => {
  it("groups by category in shelf order and sends unknown ones to other", () => {
    const groups = groupByCategory([{ id: 1, category: "ink" }, { id: 2, category: "paper" }, { id: 3, category: "weird" }, { id: 4, category: "paper" }]);
    expect(groups.map((group) => group.category)).toEqual(["paper", "ink", "other"]);
    expect(groups[0]!.items).toHaveLength(2);
  });
  it("signs an adjustment", () => {
    expect(signedAdjustment("increase", "5")).toBe("5.00");
    expect(signedAdjustment("decrease", "2.5")).toBe("-2.50");
    expect(signedAdjustment("increase", "0")).toBeNull();
    expect(signedAdjustment("increase", "1.234")).toBeNull();
  });
  it("builds movement bodies", () => {
    expect(movementBody({ type: "usage", quantity: "3" })).toEqual({ movement_type: "usage", quantity: "3.00" });
    expect(movementBody({ type: "adjustment", quantity: "3", direction: "decrease", note: "count" })).toEqual({ movement_type: "adjustment", quantity: "-3.00", note: "count" });
    expect(movementBody({ type: "purchase", quantity: "10", unitCost: "2.5", currency: "USD", recordExpense: true })).toEqual({ movement_type: "purchase", quantity: "10.00", unit_cost: "2.50", currency: "USD", record_expense: true });
    expect(movementBody({ type: "purchase", quantity: "10", unitCost: "" })).toBeNull();
    expect(movementBody({ type: "usage", quantity: "-1" })).toBeNull();
  });
  it("previews the quantity after a movement", () => {
    expect(quantityAfter("10", movementBody({ type: "usage", quantity: "3" }))).toBe("7.00");
    expect(quantityAfter("10", movementBody({ type: "waste", quantity: "1.5" }))).toBe("8.50");
    expect(quantityAfter("10", movementBody({ type: "adjustment", quantity: "4", direction: "decrease" }))).toBe("6.00");
  });
});

describe("exchange rates", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  it("picks the latest rate that is already in force", () => {
    const rows = [
      { id: 1, effective_from: "2026-01-01T00:00:00Z", syp_per_usd: "13000" },
      { id: 2, effective_from: "2026-09-01T00:00:00Z", syp_per_usd: "13500" },
      { id: 3, effective_from: "2027-01-01T00:00:00Z", syp_per_usd: "14000" },
    ];
    expect(currentExchangeRate(rows, now)?.id).toBe(2);
  });
  it("is null with no rate", () => expect(currentExchangeRate([], now)).toBeNull());
});

describe("summary parsing", () => {
  const raw = {
    period: { from: "2026-10-01", to: "2026-10-17" }, report_currency: "USD", exchange_rate: null, orders_count: 2,
    revenue: { SYP: "1000.00", USD: "5.00" }, collected: { SYP: "500.00" }, expenses: { SYP: "100.00" },
    expenses_by_category: { supplies: { SYP: "60.00" }, rent: { SYP: "40.00" } },
    totals: { revenue: null, collected: null, expenses: null, net: null, outstanding: null }, stock_value: { SYP: "10.00" }, stock_value_total: null,
    low_stock: [{ id: 1, name: "A4", category: "paper", quantity: "2.00", unit: "ream", reorder_level: "5.00" }],
  };
  it("normalises the payload and detects a missing rate", () => {
    const summary = parseSummary(raw);
    expect(summary.reportCurrency).toBe("USD");
    expect(summary.revenue.USD).toBe("5.00");
    expect(summary.lowStock[0]!.name).toBe("A4");
    expect(missingRateForTotals(summary)).toBe(true);
  });
  it("shows no missing-rate notice when a rate exists", () => expect(missingRateForTotals(parseSummary({ ...raw, exchange_rate: { syp_per_usd: "13000" }, totals: { revenue: "1", collected: "1", expenses: "1" }, stock_value_total: "1" }))).toBe(false));
  it("survives an empty payload", () => expect(parseSummary(undefined).ordersCount).toBe(0));
  it("filters expense totals by category and currency", () => {
    const summary = parseSummary(raw);
    expect(expenseTotals(summary, "", "")).toEqual([{ currency: "SYP", total: "100.00" }]);
    expect(expenseTotals(summary, "rent", "")).toEqual([{ currency: "SYP", total: "40.00" }]);
    expect(expenseTotals(summary, "", "USD")).toEqual([]);
  });
  it("reads the jobs totals per currency", () => expect(parseJobTotals({ USD: { total: "5.00", orders: 1 }, SYP: { total: "1000.00", orders: 3 } })).toEqual([{ currency: "SYP", total: "1000.00", orders: 3 }, { currency: "USD", total: "5.00", orders: 1 }]));
});

describe("permission override path and date/decimal fields", () => {
  it("addresses the override by path", () => expect(permissionOverridePath(5, "printing.manage")).toBe("/api/v1/dashboard/users/5/permission-overrides/printing.manage/"));
  const base: FieldSpec = { name: "x", kind: "date", required: true, nullable: false };
  it("accepts only real calendar dates", () => {
    expect(parseField(base, "2026-10-17", "create")).toEqual({ ok: true, value: "2026-10-17" });
    expect(parseField(base, "2026-02-30", "create").ok).toBe(false);
    expect(parseField(base, "17/10/2026", "create").ok).toBe(false);
  });
  it("allows four decimals for a rate", () => {
    const rate: FieldSpec = { name: "syp_per_usd", kind: "decimal", required: true, nullable: false, decimalPlaces: 4 };
    expect(parseField(rate, "13250.1234", "create").ok).toBe(true);
    expect(parseField({ ...rate, decimalPlaces: undefined }, "1.234", "create").ok).toBe(false);
  });
});
