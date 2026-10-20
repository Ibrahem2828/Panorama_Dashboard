/**
 * Pure rules of the finance and stock screens (mirrors apps/finance in the backend). Money arrives as decimal strings
 * with two places; amounts are compared and subtracted in whole minor units so no floating point error shows up.
 */

export const FINANCE_CURRENCIES = ["SYP", "USD"] as const;
export type FinanceCurrency = (typeof FINANCE_CURRENCIES)[number];

/** Symbols: "ل.س" for the new Syrian pound, "$" for the US dollar. */
export const CURRENCY_SYMBOL: Record<FinanceCurrency, string> = { SYP: "ل.س", USD: "$" };

export const INVENTORY_CATEGORIES = ["paper", "ink", "pens", "printer", "other"] as const;
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export const EXPENSE_CATEGORIES = ["supplies", "equipment", "maintenance", "salaries", "rent", "utilities", "transport", "other"] as const;
export const PAYMENT_METHODS = ["cash", "bank_transfer", "mobile_wallet", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const MOVEMENT_TYPES = ["purchase", "usage", "waste", "adjustment"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const VOID_REASON_MIN = 5;
export const VOID_REASON_MAX = 255;

export function isFinanceCurrency(value: unknown): value is FinanceCurrency {
  return value === "SYP" || value === "USD";
}

function numberLocale(locale: string) {
  // Western digits (0-9) for money even in Arabic; Arabic-aware grouping with a comma.
  return locale === "en" ? "en-US" : "ar-SY-u-nu-latn";
}

/** Whole minor units (hundredths) of a decimal string or number; null when it is not a finite amount. */
export function toMinor(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(number) ? Math.round(number * 100) : null;
}

/** `1250` minor units -> "12.50". */
export function fromMinor(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const absolute = Math.abs(Math.round(minor));
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

/** Number with grouping and Western digits ("1,250.5"); "—" for anything that is not a number. */
export function formatAmount(value: unknown, locale = "ar", fractionDigits: { min?: number; max?: number } = {}): string {
  const minor = toMinor(value);
  if (minor === null) return "—";
  return new Intl.NumberFormat(numberLocale(locale), { minimumFractionDigits: fractionDigits.min ?? 0, maximumFractionDigits: fractionDigits.max ?? 2 }).format(minor / 100);
}

/** "1,250 ل.س" or "$12.50"; the dollar keeps two places, the pound drops a zero fraction. */
export function formatMoney(value: unknown, currency: unknown, locale = "ar"): string {
  if (toMinor(value) === null) return "—";
  if (currency === "USD") return `${CURRENCY_SYMBOL.USD}${formatAmount(value, locale, { min: 2, max: 2 })}`;
  const symbol = currency === "SYP" ? CURRENCY_SYMBOL.SYP : "";
  return `${formatAmount(value, locale)}${symbol ? ` ${symbol}` : ""}`;
}

/** An exchange rate keeps up to four places ("13,250.5"); "—" when it is not a number. */
export function formatRate(value: unknown, locale = "ar"): string {
  const number = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(number)) return "—";
  return new Intl.NumberFormat(numberLocale(locale), { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(number);
}

/** A stock rule amount ("0.00005" for ink): up to six places, Western digits, never rounded to "0". */
export function formatPerUse(value: unknown, locale = "ar"): string {
  const number = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(number)) return "—";
  return new Intl.NumberFormat(numberLocale(locale), { minimumFractionDigits: 0, maximumFractionDigits: 6 }).format(number);
}

/** Quantities keep up to two places and never show an Arabic digit ("12.5"). */
export function formatQuantity(value: unknown, locale = "ar"): string {
  return formatAmount(value, locale, { min: 0, max: 2 });
}

/** A calendar day (YYYY-MM-DD) or timestamp rendered as a date, without any time-zone shift for date-only values. */
export function formatDay(value: unknown, locale = "ar"): string {
  if (!value) return "—";
  const raw = String(value);
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/u.test(raw);
  const date = new Date(dateOnly ? `${raw}T00:00:00Z` : raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SY" : "en-GB", { dateStyle: "medium", ...(dateOnly ? { timeZone: "UTC" } : {}) }).format(date);
}

/** What is still owed: total minus paid, never below zero, as a two-place decimal string. */
export function dueAmount(total: unknown, paid: unknown): string {
  const owed = toMinor(total);
  if (owed === null) return "0.00";
  return fromMinor(Math.max(0, owed - (toMinor(paid) ?? 0)));
}

export function isSettled(total: unknown, paid: unknown): boolean {
  return toMinor(dueAmount(total, paid)) === 0;
}

/** A payment amount must be positive, have at most two places and not exceed what is due. */
export type PaymentAmountProblem = "invalid" | "tooMany" | "exceeds";
export function paymentAmountProblem(text: string, due: unknown): PaymentAmountProblem | null {
  const trimmed = text.trim();
  if (!/^\d+(?:\.\d+)?$/u.test(trimmed) || Number(trimmed) <= 0) return "invalid";
  if ((trimmed.split(".")[1] ?? "").length > 2) return "tooMany";
  const amount = toMinor(trimmed);
  const remaining = toMinor(due);
  if (amount === null || amount <= 0) return "invalid";
  if (remaining !== null && amount > remaining) return "exceeds";
  return null;
}

// --- periods ---------------------------------------------------------------------------------------------------

export type PeriodPreset = "today" | "week" | "month" | "custom";
export interface PeriodRange { from: string; to: string }

/** Local calendar day as YYYY-MM-DD (the format the finance endpoints take). */
export function localIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** The week starts on Sunday (the first working day in Syria). */
export function periodRange(preset: PeriodPreset, now: Date = new Date(), custom?: Partial<PeriodRange>): PeriodRange {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "today") return { from: localIsoDate(today), to: localIsoDate(today) };
  if (preset === "week") {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
    return { from: localIsoDate(start), to: localIsoDate(today) };
  }
  if (preset === "month") return { from: localIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: localIsoDate(today) };
  return { from: custom?.from ?? "", to: custom?.to ?? "" };
}

/** null when both ends are set and the end is not before the start. */
export function customRangeProblem(from: string, to: string): "incomplete" | "order" | null {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(from) || !/^\d{4}-\d{2}-\d{2}$/u.test(to)) return "incomplete";
  return to < from ? "order" : null;
}

// --- exchange rates --------------------------------------------------------------------------------------------

export interface RateRow { id?: number | string; effective_from?: string | null; syp_per_usd?: string | number; created_at?: string | null }

/** The rate in force: the latest `effective_from` that is not in the future (ties: the newest record). */
export function currentExchangeRate<T extends RateRow>(rows: readonly T[], now: Date = new Date()): T | null {
  let best: T | null = null;
  for (const row of rows) {
    const at = Date.parse(String(row.effective_from ?? row.created_at ?? ""));
    if (Number.isNaN(at) || at > now.getTime()) continue;
    const bestAt = best ? Date.parse(String(best.effective_from ?? best.created_at ?? "")) : -Infinity;
    if (at > bestAt || (at === bestAt && Number(row.id) > Number(best?.id))) best = row;
  }
  return best;
}

// --- summary ---------------------------------------------------------------------------------------------------

type MoneyByCurrency = Partial<Record<FinanceCurrency, string>>;
export interface FinanceSummary {
  period: PeriodRange;
  reportCurrency: FinanceCurrency;
  exchangeRate: { sypPerUsd: string; effectiveFrom: string | null } | null;
  ordersCount: number;
  filesCount: number;
  pagesCount: number;
  sheetsCount: number;
  revenue: MoneyByCurrency;
  collected: MoneyByCurrency;
  expenses: MoneyByCurrency;
  expensesByCategory: { category: string; amounts: MoneyByCurrency }[];
  stockValue: MoneyByCurrency;
  totals: { revenue: string | null; collected: string | null; expenses: string | null; net: string | null; outstanding: string | null; stockValue: string | null };
  lowStock: { id: number; name: string; category: string; quantity: string; unit: string; reorderLevel: string }[];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function text(value: unknown): string | null {
  return value === null || value === undefined || value === "" ? null : String(value);
}
function count(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
function perCurrency(value: unknown): MoneyByCurrency {
  const result: MoneyByCurrency = {};
  for (const [key, amount] of Object.entries(record(value))) if (isFinanceCurrency(key) && text(amount) !== null) result[key] = String(amount);
  return result;
}

/** Normalises the free-form summary payload (decimals as strings or numbers, missing parts) into a typed model. */
export function parseSummary(raw: unknown): FinanceSummary {
  const data = record(raw);
  const totals = record(data.totals);
  const rate = record(data.exchange_rate);
  const period = record(data.period);
  return {
    period: { from: text(period.from) ?? "", to: text(period.to) ?? "" },
    reportCurrency: isFinanceCurrency(data.report_currency) ? data.report_currency : "SYP",
    exchangeRate: text(rate.syp_per_usd) !== null ? { sypPerUsd: String(rate.syp_per_usd), effectiveFrom: text(rate.effective_from) } : null,
    ordersCount: count(data.orders_count),
    filesCount: count(data.files_count),
    pagesCount: count(data.pages_count),
    sheetsCount: count(data.sheets_count),
    revenue: perCurrency(data.revenue),
    collected: perCurrency(data.collected),
    expenses: perCurrency(data.expenses),
    expensesByCategory: Object.entries(record(data.expenses_by_category)).map(([category, amounts]) => ({ category, amounts: perCurrency(amounts) })),
    stockValue: perCurrency(data.stock_value),
    totals: {
      revenue: text(totals.revenue),
      collected: text(totals.collected),
      expenses: text(totals.expenses),
      net: text(totals.net),
      outstanding: text(totals.outstanding),
      stockValue: text(data.stock_value_total),
    },
    lowStock: (Array.isArray(data.low_stock) ? data.low_stock : []).map((item) => {
      const row = record(item);
      return { id: count(row.id), name: text(row.name) ?? "", category: text(row.category) ?? "other", quantity: text(row.quantity) ?? "0", unit: text(row.unit) ?? "", reorderLevel: text(row.reorder_level) ?? "0" };
    }),
  };
}

/** True when a total could not be converted because no exchange rate exists (the backend answers null, never a guess). */
export function missingRateForTotals(summary: FinanceSummary): boolean {
  if (summary.exchangeRate) return false;
  const { revenue, collected, expenses, stockValue } = summary.totals;
  return [revenue, collected, expenses, stockValue].some((value) => value === null);
}

/** Whether a per-currency bucket holds any non-zero amount. */
export function hasAmounts(bucket: MoneyByCurrency): boolean {
  return FINANCE_CURRENCIES.some((currency) => (toMinor(bucket[currency]) ?? 0) !== 0);
}

// --- stock -----------------------------------------------------------------------------------------------------

export interface StockItemLike { id?: number | string; category?: string | null; name?: string | null }

/** Items grouped by category in the fixed shelf order; unknown categories fall under "other"; empty groups are left out. */
export function groupByCategory<T extends StockItemLike>(items: readonly T[]): { category: InventoryCategory; items: T[] }[] {
  const groups = new Map<InventoryCategory, T[]>(INVENTORY_CATEGORIES.map((category) => [category, []]));
  for (const item of items) {
    const category = INVENTORY_CATEGORIES.find((candidate) => candidate === item.category) ?? "other";
    groups.get(category)!.push(item);
  }
  return INVENTORY_CATEGORIES.map((category) => ({ category, items: groups.get(category)! })).filter((group) => group.items.length > 0);
}

export type AdjustmentDirection = "increase" | "decrease";

/** The signed quantity an adjustment sends: positive adds to the shelf, negative removes. null for a non-positive amount. */
export function signedAdjustment(direction: AdjustmentDirection, amount: string): string | null {
  const minor = toMinor(amount);
  if (minor === null || minor <= 0 || !/^\d+(?:\.\d{1,2})?$/u.test(amount.trim())) return null;
  return direction === "decrease" ? `-${fromMinor(minor)}` : fromMinor(minor);
}

export interface MovementInput {
  type: MovementType;
  quantity: string;
  direction?: AdjustmentDirection;
  unitCost?: string;
  currency?: FinanceCurrency;
  note?: string;
  recordExpense?: boolean;
}

/** Request body of POST stock/{id}/movements/; null when the quantity (or a purchase's unit cost) is not valid. */
export function movementBody(input: MovementInput): Record<string, unknown> | null {
  // Purchase, usage and waste always send a positive quantity; only an adjustment is signed.
  const quantity = signedAdjustment(input.type === "adjustment" ? input.direction ?? "increase" : "increase", input.quantity);
  if (quantity === null) return null;
  const body: Record<string, unknown> = { movement_type: input.type, quantity };
  if (input.note?.trim()) body.note = input.note.trim();
  if (input.type === "purchase") {
    const cost = (input.unitCost ?? "").trim();
    if (!/^\d+(?:\.\d{1,2})?$/u.test(cost)) return null;
    body.unit_cost = fromMinor(toMinor(cost) ?? 0);
    body.currency = input.currency ?? "SYP";
    body.record_expense = Boolean(input.recordExpense);
  }
  return body;
}

/** Quantity on the shelf after a movement, for the preview in the dialog; null when it cannot be computed. */
export function quantityAfter(current: unknown, movement: Record<string, unknown> | null): string | null {
  const now = toMinor(current);
  const change = toMinor(movement?.quantity);
  if (now === null || change === null || !movement) return null;
  const type = movement.movement_type;
  const next = type === "usage" || type === "waste" ? now - change : now + change;
  return fromMinor(next);
}

/** Total cost of a purchase (quantity x unit cost) for the preview, as a two-place string; null when incomplete. */
export function purchaseTotal(quantity: string, unitCost: string): string | null {
  const q = toMinor(quantity);
  const c = toMinor(unitCost);
  if (q === null || c === null) return null;
  return fromMinor(Math.round((q * c) / 100));
}

/** Request body of POST printing/payments/. */
export function paymentBody(order: number | string, amount: string, method: PaymentMethod, note: string): Record<string, unknown> {
  const body: Record<string, unknown> = { order: Number(order), amount: amount.trim(), method };
  if (note.trim()) body.note = note.trim();
  return body;
}

export const FINANCE_PATHS = {
  summary: "/api/v1/dashboard/finance/summary/",
  jobs: "/api/v1/dashboard/printing/jobs/",
  payments: "/api/v1/dashboard/printing/payments/",
  stock: "/api/v1/dashboard/printing/stock/",
  rates: "/api/v1/dashboard/finance/exchange-rates/",
} as const;

export function stockMovementsPath(itemId: number | string): string {
  return `${FINANCE_PATHS.stock}${encodeURIComponent(String(itemId))}/movements/`;
}
export function stockHistoryPath(itemId: number | string): string {
  return `${FINANCE_PATHS.stock}${encodeURIComponent(String(itemId))}/movement-history/`;
}
export function paymentVoidPath(paymentId: number | string): string {
  return `/api/v1/dashboard/finance/payments/${encodeURIComponent(String(paymentId))}/void/`;
}

/** Query string with the period (from/to) plus any extra non-empty parameters. */
export function periodQuery(range: PeriodRange, extra: Record<string, string | undefined> = {}): URLSearchParams {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  for (const [key, value] of Object.entries(extra)) if (value) params.set(key, value);
  return params;
}

export type PaymentState = "paid" | "partial" | "unpaid";

/** Settled, partly paid or not paid at all (an order with nothing to pay counts as settled). */
export function paymentState(total: unknown, paid: unknown): PaymentState {
  if (isSettled(total, paid)) return "paid";
  return (toMinor(paid) ?? 0) > 0 ? "partial" : "unpaid";
}

export interface JobTotals { currency: FinanceCurrency; total: string; orders: number }

/** `totals_by_currency` of the jobs list as an ordered list (pound first), skipping unknown currencies. */
export function parseJobTotals(raw: unknown): JobTotals[] {
  const data = record(raw);
  return FINANCE_CURRENCIES.flatMap((currency) => {
    const row = record(data[currency]);
    return text(row.total) === null ? [] : [{ currency, total: String(row.total), orders: count(row.orders) }];
  });
}

/** Expense totals for the filters in force: one category (or all) and one currency (or both), per currency. */
export function expenseTotals(summary: FinanceSummary, category: string, currency: string): { currency: FinanceCurrency; total: string }[] {
  const source = category ? summary.expensesByCategory.find((row) => row.category === category)?.amounts ?? {} : summary.expenses;
  return FINANCE_CURRENCIES.filter((code) => !currency || currency === code).flatMap((code) => (source[code] !== undefined ? [{ currency: code, total: source[code] as string }] : []));
}

// --- low-stock alerts ---------------------------------------------------------------------------------------------

/** The part of a stock row the alert needs. Quantities are decimal strings. */
export interface LowStockItem { id: number; name: string; unit: string; quantity: string; reorder_level: string }

export const LOW_STOCK_PATH = "/api/v1/dashboard/printing/stock/?low=true&active=true&page_size=50";

export function isOutOfStock(item: Pick<LowStockItem, "quantity">): boolean {
  return (toMinor(item.quantity) ?? 0) <= 0;
}

/** Items that ran out first, then the ones furthest under their reorder level (the emptiest relative to the level). */
export function sortLowStock<T extends LowStockItem>(items: readonly T[]): T[] {
  const fill = (item: LowStockItem) => {
    const level = toMinor(item.reorder_level) ?? 0;
    return level > 0 ? (toMinor(item.quantity) ?? 0) / level : 0;
  };
  return [...items].sort((a, b) => Number(isOutOfStock(b)) - Number(isOutOfStock(a)) || fill(a) - fill(b) || a.name.localeCompare(b.name));
}

/**
 * The items that are low now but were not in the previous list: the ones to announce with a toast. `previous` is null on the
 * very first load, when everything that is low is already on the banner and must not pop up as if it had just happened.
 */
export function newlyLow<T extends LowStockItem>(previous: ReadonlySet<number> | null, current: readonly T[]): T[] {
  if (previous === null) return [];
  return current.filter((item) => !previous.has(item.id));
}

// --- monthly stock report ---------------------------------------------------------------------------------------------

export const STOCK_REPORT_PATH = "/api/v1/dashboard/finance/stock-report/";

/** "2026-10" for a date: the month the report opens on. */
export function monthOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** The month `delta` months from `month` ("2026-01", -1 -> "2025-12"); null when `month` is not YYYY-MM. */
export function shiftMonth(month: string, delta: number): string | null {
  const match = /^(\d{4})-(\d{2})$/u.exec(month);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return null;
  const index = Number(match[1]) * 12 + (Number(match[2]) - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function isFutureMonth(month: string, now: Date = new Date()): boolean {
  return month > monthOf(now);
}

export interface StockReportRow {
  id: number;
  name: string;
  category: string;
  unit: string;
  opening: string;
  purchased: string;
  purchaseCost: Partial<Record<FinanceCurrency, string>>;
  used: string;
  usedByOrders: string;
  usedByHand: string;
  waste: string;
  adjustment: string;
  closing: string;
  isLow: boolean;
  dailyUsage: string | null;
  daysLeft: number | null;
  suggestedPurchase: string | null;
}

export interface StockReport {
  month: string;
  daysElapsed: number;
  coverDays: number;
  rows: StockReportRow[];
  purchaseCost: Partial<Record<FinanceCurrency, string>>;
  ordersDelivered: number;
  sheetsPrinted: number;
  itemsLow: number;
}

function amountText(value: unknown, fallback = "0.00"): string {
  const minor = toMinor(value);
  return minor === null ? fallback : fromMinor(minor);
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function costMap(raw: unknown): Partial<Record<FinanceCurrency, string>> {
  const result: Partial<Record<FinanceCurrency, string>> = {};
  if (typeof raw === "object" && raw !== null) {
    for (const [currency, amount] of Object.entries(raw)) if (isFinanceCurrency(currency) && toMinor(amount) !== null) result[currency] = amountText(amount);
  }
  return result;
}

/** The monthly report from the API, with every number checked: an unexpected shape gives null instead of a broken table. */
export function parseStockReport(raw: unknown): StockReport | null {
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.month !== "string" || !Array.isArray(data.items)) return null;
  const totals = (typeof data.totals === "object" && data.totals !== null ? data.totals : {}) as Record<string, unknown>;
  const rows = data.items.flatMap((entry): StockReportRow[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== "number" || typeof item.name !== "string") return [];
    const daily = optionalNumber(item.daily_usage);
    const suggested = optionalNumber(item.suggested_purchase);
    return [{
      id: item.id, name: item.name, category: typeof item.category === "string" ? item.category : "other", unit: typeof item.unit === "string" ? item.unit : "",
      opening: amountText(item.opening), purchased: amountText(item.purchased), purchaseCost: costMap(item.purchase_cost), used: amountText(item.used),
      usedByOrders: amountText(item.used_by_orders), usedByHand: amountText(item.used_by_hand), waste: amountText(item.waste), adjustment: amountText(item.adjustment), closing: amountText(item.closing),
      isLow: item.is_low === true, dailyUsage: daily === null ? null : String(daily), daysLeft: optionalNumber(item.days_left),
      suggestedPurchase: suggested === null ? null : amountText(suggested),
    }];
  });
  return {
    month: data.month,
    daysElapsed: optionalNumber(data.days_elapsed) ?? 0,
    coverDays: optionalNumber(data.cover_days) ?? 30,
    rows,
    purchaseCost: costMap(totals.purchase_cost),
    ordersDelivered: optionalNumber(totals.orders_delivered) ?? 0,
    sheetsPrinted: optionalNumber(totals.sheets_printed) ?? 0,
    itemsLow: optionalNumber(totals.items_low) ?? 0,
  };
}

export type StockCoverState = "out" | "critical" | "soon" | "ok" | "unknown";

/** How worried to be about an item: out of stock, under a week of cover, under two, fine, or not enough usage data to say. */
export function stockCover(row: Pick<StockReportRow, "closing" | "daysLeft">): StockCoverState {
  if ((toMinor(row.closing) ?? 0) <= 0) return "out";
  if (row.daysLeft === null) return "unknown";
  if (row.daysLeft < 7) return "critical";
  return row.daysLeft < 14 ? "soon" : "ok";
}

/** Bar lengths (0-100) for purchases and usage, both measured against the biggest figure of the month so rows compare. */
export function barShares(rows: readonly Pick<StockReportRow, "purchased" | "used">[]): { purchased: number; used: number }[] {
  const peak = Math.max(0, ...rows.flatMap((row) => [toMinor(row.purchased) ?? 0, toMinor(row.used) ?? 0]));
  const share = (value: string) => (peak > 0 ? Math.round(((toMinor(value) ?? 0) / peak) * 100) : 0);
  return rows.map((row) => ({ purchased: share(row.purchased), used: share(row.used) }));
}

/** CSV (with a BOM so Excel reads Arabic) of the report; `labels` are the column titles in the user's language. */
export function stockReportCsv(rows: readonly StockReportRow[], labels: readonly string[]): string {
  const cell = (value: string | number | null) => {
    const textValue = value === null ? "" : String(value);
    // A cell that starts like a formula is neutralised so a stock name cannot run in a spreadsheet.
    const safe = /^[=+\-@\t\r]/u.test(textValue) && !/^-?\d+(?:\.\d+)?$/u.test(textValue) ? `'${textValue}` : textValue;
    return /[",\n\r]/u.test(safe) ? `"${safe.replace(/"/gu, '""')}"` : safe;
  };
  const lines = [labels.map(cell).join(",")];
  for (const row of rows) {
    lines.push([row.name, row.unit, row.opening, row.purchased, row.used, row.usedByOrders, row.usedByHand, row.waste, row.adjustment, row.closing, row.dailyUsage, row.daysLeft, row.suggestedPurchase].map(cell).join(","));
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
