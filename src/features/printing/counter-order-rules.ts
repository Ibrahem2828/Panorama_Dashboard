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
/** Pages-per-sheet values the server accepts (apps/printing/options.py PAGES_PER_SHEET_CHOICES). */
export const PAGES_PER_SHEET_CHOICES: readonly number[] = [1, 2, 4, 6, 9, 16];

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
  /** Pages printed on one face of a sheet (N-up): 1, 2, 4, 6, 9 or 16. */
  pagesPerSheet: number;
  /** Code of the cover option from the shop catalog, "" for none. */
  cover: string;
  /** Helper only (never sent): pages of the whole document and the range to print, to work out the pages of one copy. */
  docPages: string;
  pageRange: string;
  /** A ready-made product: its specification and fixed price are used and the options above are ignored. */
  productId: number | null;
  productName: string;
}

let counter = 0;
export function newLine(): CounterLine {
  counter += 1;
  return { key: `line-${Date.now().toString(36)}-${counter}`, title: "", pages: "", copies: "1", colorMode: "black_white", paperSize: "A4", sides: "one_sided", binding: "none", bindingNote: "", pagesPerSheet: 1, cover: "", docPages: "", pageRange: "", productId: null, productName: "" };
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
  if (wholeNumber(line.copies, COUNTER_MAX_COPIES) === null) problems.copies = true;
  if (line.productId !== null) return problems;
  if (wholeNumber(line.pages, COUNTER_MAX_PAGES) === null) problems.pages = true;
  if (line.binding === "other" && !line.bindingNote.trim()) problems.bindingNote = true;
  return problems;
}

export function lineIsValid(line: CounterLine): boolean {
  return Object.keys(lineProblems(line)).length === 0;
}

/** Physical sheets for all copies: a double-sided sheet carries two pages. */
export function lineSheets(line: CounterLine): number | null {
  if (line.productId !== null) return null; // the sheets of a product come from its specification, on the server
  const pages = wholeNumber(line.pages, COUNTER_MAX_PAGES);
  const copies = wholeNumber(line.copies, COUNTER_MAX_COPIES);
  if (pages === null || copies === null) return null;
  const faces = Math.max(Math.ceil(pages / pagesPerSheetOf(line)), 1);
  return (line.sides === "double_sided" ? Math.ceil(faces / 2) : faces) * copies;
}

function pagesPerSheetOf(line: CounterLine): number {
  return PAGES_PER_SHEET_CHOICES.includes(line.pagesPerSheet) ? line.pagesPerSheet : 1;
}

export type PageRangeResult = { count: number } | { error: "empty" | "format" | "order" | "beyond" | "docPages" };

/** Pages selected by a range like "1-5, 8" in a document of `total` pages (same rules as the server's parse_page_range). */
export function pageRangeCount(range: string, total: number): PageRangeResult {
  if (!Number.isInteger(total) || total < 1) return { error: "docPages" };
  const cleaned = range.trim();
  if (!cleaned) return { count: total };
  const seen = new Set<number>();
  for (const part of cleaned.replace(/،/gu, ",").replace(/;/gu, ",").split(",")) {
    if (!part.trim()) continue;
    const match = /^\s*(\d+)\s*(?:[-–—]\s*(\d+))?\s*$/u.exec(part);
    if (!match) return { error: "format" };
    const first = Number(match[1]);
    const last = Number(match[2] ?? match[1]);
    if (first < 1 || last < first) return { error: "order" };
    if (last > total) return { error: "beyond" };
    for (let page = first; page <= last; page += 1) seen.add(page);
  }
  return seen.size ? { count: seen.size } : { error: "empty" };
}

export function itemBody(line: CounterLine): Record<string, unknown> {
  if (line.productId !== null) return { product: line.productId, copies: Number(line.copies) };
  const body: Record<string, unknown> = {
    pages_count: Number(line.pages),
    copies: Number(line.copies),
    color_mode: line.colorMode,
    paper_size: line.paperSize,
    sides: line.sides,
    binding: line.binding,
  };
  if (line.title.trim()) body.title = line.title.trim();
  if (pagesPerSheetOf(line) !== 1) body.pages_per_sheet = pagesPerSheetOf(line);
  if (line.cover) body.cover = line.cover;
  if (line.binding === "other") body.binding_note = line.bindingNote.trim().slice(0, BINDING_NOTE_MAX);
  return body;
}

export function quoteBody(lines: readonly CounterLine[], currency: FinanceCurrency): Record<string, unknown> {
  return { items: lines.map(itemBody), currency };
}

// ---- the quote ---------------------------------------------------------------------------------------------------------------

export interface QuoteLine { pages: number; sheets: number; subtotal: string | null; unitPrice: string | null; bindingPrice: string | null; unavailable: "pricing" | "binding" | null }

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
      return { pages: Number(item.pages_count) || 0, sheets: Number(item.sheets_count) || 0, subtotal: amountText(item.subtotal), unitPrice: amountText(item.unit_price), bindingPrice: amountText(item.binding_price), unavailable };
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

// ---- copy an existing order into the counter form ---------------------------------------------------------------------------------

function positive(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) && number >= 1 ? Math.floor(number) : null;
}

/**
 * The counter lines that reproduce an existing order's items (reprint / duplicate). Pages are the pages that were printed
 * (page range applied); only options the counter form supports are carried over. Capped at the form's line limit.
 */
export function linesFromOrderItems(raw: unknown): CounterLine[] {
  if (!Array.isArray(raw)) return [];
  const lines: CounterLine[] = [];
  for (const entry of raw) {
    if (lines.length >= COUNTER_MAX_LINES) break;
    if (typeof entry !== "object" || entry === null) continue;
    const item = entry as Record<string, unknown>;
    const base = newLine();
    const copies = String(Math.min(COUNTER_MAX_COPIES, positive(item.copies) ?? 1));
    const name = typeof item.original_file_name === "string" ? item.original_file_name.trim() : "";
    const productId = positive(item.product);
    if (productId !== null) {
      lines.push({ ...base, copies, productId, productName: name, title: name });
      continue;
    }
    const pages = positive(item.selected_pages) ?? positive(item.pages_count);
    const perSheet = positive(item.pages_per_sheet) ?? 1;
    const binding = typeof item.binding === "string" && /^[a-z0-9_-]{1,32}$/iu.test(item.binding) ? item.binding : "none";
    lines.push({
      ...base,
      title: name.slice(0, 255),
      pages: pages === null ? "" : String(Math.min(COUNTER_MAX_PAGES, pages)),
      copies,
      colorMode: item.color_mode === "color" ? "color" : "black_white",
      paperSize: (COUNTER_PAPERS as readonly string[]).includes(String(item.paper_size)) ? (item.paper_size as PaperSize) : "A4",
      sides: item.sides === "double_sided" ? "double_sided" : "one_sided",
      binding,
      bindingNote: typeof item.binding_note === "string" ? item.binding_note.trim().slice(0, BINDING_NOTE_MAX) : "",
      pagesPerSheet: PAGES_PER_SHEET_CHOICES.includes(perSheet) ? perSheet : 1,
      cover: typeof item.cover === "string" ? item.cover : "",
    });
  }
  return lines;
}
