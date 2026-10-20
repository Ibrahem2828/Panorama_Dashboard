import { fromMinor, toMinor, type FinanceCurrency, type PaymentMethod } from "@/features/finance/finance-rules";
import type { Binding, ColorMode, PaperSize, Sides } from "@/features/printing/print-order-rules";

/** Rules of the "order from the shop counter" form (mirrors CounterOrderService in the backend). */

export const COUNTER_STATUSES = ["printing", "ready", "delivered"] as const;
export type CounterStatus = (typeof COUNTER_STATUSES)[number];

export const COUNTER_BINDINGS: readonly Binding[] = ["none", "staple", "spiral", "beads", "thermal", "other"];
export const COUNTER_PAPERS: readonly PaperSize[] = ["A5", "A4", "A3"];
export const COUNTER_MAX_LINES = 20;
export const COUNTER_MAX_PAGES = 100_000;
export const COUNTER_MAX_COPIES = 99;
export const BINDING_NOTE_MAX = 120;

export const COUNTER_PATHS = {
  quote: "/api/v1/dashboard/printing/counter-orders/quote/",
  create: "/api/v1/dashboard/printing/counter-orders/",
} as const;

/** One file/job as the cashier types it. Numbers stay text while typing so an empty box is not forced to "0". */
export interface CounterLine {
  key: string;
  title: string;
  pages: string;
  copies: string;
  colorMode: ColorMode;
  paperSize: PaperSize;
  sides: Sides;
  binding: Binding;
  bindingNote: string;
}

let counter = 0;
export function newLine(): CounterLine {
  counter += 1;
  return { key: `line-${Date.now().toString(36)}-${counter}`, title: "", pages: "", copies: "1", colorMode: "black_white", paperSize: "A4", sides: "one_sided", binding: "none", bindingNote: "" };
}

/** A positive whole number within bounds, or null. */
export function wholeNumber(text: string, max: number): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/u.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= 1 && value <= max ? value : null;
}

export interface LineProblems { pages?: boolean; copies?: boolean; bindingNote?: boolean }

export function lineProblems(line: CounterLine): LineProblems {
  const problems: LineProblems = {};
  if (wholeNumber(line.pages, COUNTER_MAX_PAGES) === null) problems.pages = true;
  if (wholeNumber(line.copies, COUNTER_MAX_COPIES) === null) problems.copies = true;
  if (line.binding === "other" && !line.bindingNote.trim()) problems.bindingNote = true;
  return problems;
}

export function lineIsValid(line: CounterLine): boolean {
  return Object.keys(lineProblems(line)).length === 0;
}

/** Physical sheets for all copies: a double-sided sheet carries two pages. */
export function lineSheets(line: CounterLine): number | null {
  const pages = wholeNumber(line.pages, COUNTER_MAX_PAGES);
  const copies = wholeNumber(line.copies, COUNTER_MAX_COPIES);
  if (pages === null || copies === null) return null;
  return (line.sides === "double_sided" ? Math.ceil(pages / 2) : pages) * copies;
}

export function itemBody(line: CounterLine): Record<string, unknown> {
  const body: Record<string, unknown> = {
    pages_count: Number(line.pages),
    copies: Number(line.copies),
    color_mode: line.colorMode,
    paper_size: line.paperSize,
    sides: line.sides,
    binding: line.binding,
  };
  if (line.title.trim()) body.title = line.title.trim();
  if (line.binding === "other") body.binding_note = line.bindingNote.trim().slice(0, BINDING_NOTE_MAX);
  return body;
}

export function quoteBody(lines: readonly CounterLine[], currency: FinanceCurrency): Record<string, unknown> {
  return { items: lines.map(itemBody), currency };
}

// ---- the quote ---------------------------------------------------------------------------------------------------------------

export interface QuoteLine { pages: number; sheets: number; subtotal: string | null; unavailable: "pricing" | "binding" | null }

export interface CounterQuote {
  /** Every line has a price in the list, so the total below is complete. */
  complete: boolean;
  exactTotal: string;
  /** The price shown to the customer (rounded to tens in pounds); null when a line has no price. */
  suggestedTotal: string | null;
  /** Rounded minus exact, signed ("-4.00"); null when there is no suggested total. */
  rounding: string | null;
  lines: QuoteLine[];
}

function amountText(value: unknown): string | null {
  const minor = toMinor(value);
  return minor === null ? null : fromMinor(minor);
}

export function parseCounterQuote(raw: unknown): CounterQuote | null {
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.items)) return null;
  return {
    complete: data.complete === true,
    exactTotal: amountText(data.exact_total) ?? "0.00",
    suggestedTotal: amountText(data.suggested_total),
    rounding: amountText(data.rounding_adjustment),
    lines: data.items.map((entry): QuoteLine => {
      const item = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
      const unavailable = item.unavailable === "binding" || item.unavailable === "pricing" ? item.unavailable : null;
      return { pages: Number(item.pages_count) || 0, sheets: Number(item.sheets_count) || 0, subtotal: amountText(item.subtotal), unavailable };
    }),
  };
}

// ---- price, payment and the request ------------------------------------------------------------------------------------------

export type AmountProblem = "required" | "invalid" | "tooMany";

/** A non-negative amount with at most two decimals. `allowEmpty` lets an optional box stay blank. */
export function amountProblem(text: string, allowEmpty = false): AmountProblem | null {
  const trimmed = text.trim();
  if (!trimmed) return allowEmpty ? null : "required";
  if (!/^\d+(?:\.\d+)?$/u.test(trimmed)) return "invalid";
  return (trimmed.split(".")[1] ?? "").length > 2 ? "tooMany" : null;
}

/** What the customer pays now when the cashier has not typed it: everything if the order is handed over, else nothing. */
export function defaultPaid(status: CounterStatus, price: string): string {
  return status === "delivered" && amountProblem(price) === null ? fromMinor(toMinor(price) ?? 0) : "0";
}

export function paidProblem(paid: string, price: string): AmountProblem | "exceeds" | null {
  const base = amountProblem(paid);
  if (base) return base;
  const paidMinor = toMinor(paid);
  const priceMinor = toMinor(price);
  return paidMinor !== null && priceMinor !== null && paidMinor > priceMinor ? "exceeds" : null;
}

export interface CounterOrderInput {
  lines: readonly CounterLine[];
  currency: FinanceCurrency;
  customerName: string;
  customerPhone: string;
  price: string;
  paid: string;
  method: PaymentMethod;
  status: CounterStatus;
  notes: string;
}

export function createBody(input: CounterOrderInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    ...quoteBody(input.lines, input.currency),
    total_price: fromMinor(toMinor(input.price) ?? 0),
    status: input.status,
    paid_amount: fromMinor(toMinor(input.paid) ?? 0),
    payment_method: input.method,
  };
  if (input.customerName.trim()) body.customer_name = input.customerName.trim();
  if (input.customerPhone.trim()) body.customer_phone = input.customerPhone.trim();
  if (input.notes.trim()) body.internal_notes = input.notes.trim();
  return body;
}

/** Can the form be submitted? Used to enable the button; the messages come from the individual problems. */
export function orderIsReady(input: CounterOrderInput): boolean {
  return input.lines.length > 0 && input.lines.length <= COUNTER_MAX_LINES && input.lines.every(lineIsValid)
    && amountProblem(input.price) === null && paidProblem(input.paid, input.price) === null;
}

/** "-4.00" -> "-4", "6.00" -> "+6": the rounding line shows a signed whole amount when it has no cents. */
export function signedRounding(value: string | null): string | null {
  const minor = toMinor(value);
  if (minor === null || minor === 0) return null;
  const text = fromMinor(Math.abs(minor)).replace(/\.00$/u, "");
  return `${minor > 0 ? "+" : "-"}${text}`;
}

// ---- the order list ----------------------------------------------------------------------------------------------------------

/** The next step of the normal print flow, so the cashier moves an order on with one click. */
const NEXT_STATUS: Record<string, string> = { submitted: "under_review", under_review: "accepted", accepted: "printing", printing: "ready", ready: "delivered" };
export function nextStatus(status: string): string | null {
  return NEXT_STATUS[status] ?? null;
}
