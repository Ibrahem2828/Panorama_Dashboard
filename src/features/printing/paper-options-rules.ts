import { fromMinor, toMinor } from "@/features/finance/finance-rules";
import type { MessageKey } from "@/i18n/messages";

/**
 * Rules of the "paper options by section" catalog (خيارات الورق حسب القسم): the choices of the order form's sections
 * (cover, transparency, delivery, finishing, design paper). The server keeps one row per section + code + currency, so one
 * option the owner sees is a pair of rows (new pounds and dollars) that are created, edited, switched and deleted together.
 */

export const EXTRA_OPTIONS_PATH = "/api/v1/dashboard/printing/extra-options/";
export function extraOptionPath(id: number | string): string {
  return `${EXTRA_OPTIONS_PATH}${encodeURIComponent(String(id))}/`;
}

export const EXTRA_SECTIONS = [
  "front_cover", "back_cover",
  "front_transparency_required", "front_transparency_optional",
  "back_transparency_required", "back_transparency_optional",
  "final_delivery", "finishing", "design_paper",
] as const;
export type ExtraSection = (typeof EXTRA_SECTIONS)[number];

export const EXTRA_PRICE_UNITS = ["per_copy", "per_50_sheets", "per_sheet"] as const;
export type ExtraPriceUnit = (typeof EXTRA_PRICE_UNITS)[number];

export const EXTRA_CURRENCIES = ["SYP", "USD"] as const;
export type ExtraCurrency = (typeof EXTRA_CURRENCIES)[number];

export const EXTRA_NAME_MAX = 150;
export const EXTRA_CODE_MAX = 48;
export const EXTRA_DESCRIPTION_MAX = 500;
export const EXTRA_SORT_MAX = 32767;

export function isExtraSection(value: unknown): value is ExtraSection {
  return typeof value === "string" && (EXTRA_SECTIONS as readonly string[]).includes(value);
}
export function isPriceUnit(value: unknown): value is ExtraPriceUnit {
  return typeof value === "string" && (EXTRA_PRICE_UNITS as readonly string[]).includes(value);
}

/** The i18n key of a section's name (the same names the order form uses). */
export function sectionLabelKey(section: ExtraSection): MessageKey {
  return `paper.section.${section}` as MessageKey;
}
export function priceUnitLabelKey(unit: ExtraPriceUnit): MessageKey {
  return `paper.unit.${unit}` as MessageKey;
}

/** What the management page draws: the two transparency choices of a face share one block ("required" / "not required"). */
export interface SectionBlock {
  id: string;
  labelKey: MessageKey;
  /** One section, or the "required" and "optional" sections of a transparency face. */
  sections: readonly ExtraSection[];
}

export const SECTION_BLOCKS: readonly SectionBlock[] = [
  { id: "front_cover", labelKey: "paper.section.front_cover", sections: ["front_cover"] },
  { id: "back_cover", labelKey: "paper.section.back_cover", sections: ["back_cover"] },
  { id: "front_transparency", labelKey: "paper.block.front_transparency", sections: ["front_transparency_required", "front_transparency_optional"] },
  { id: "back_transparency", labelKey: "paper.block.back_transparency", sections: ["back_transparency_required", "back_transparency_optional"] },
  { id: "final_delivery", labelKey: "paper.section.final_delivery", sections: ["final_delivery"] },
  { id: "finishing", labelKey: "paper.section.finishing", sections: ["finishing"] },
  { id: "design_paper", labelKey: "paper.section.design_paper", sections: ["design_paper"] },
];

/** The sub-heading of a section inside a multi-section block ("required" / "not required"), or null for a single-section block. */
export function subSectionLabelKey(section: ExtraSection): MessageKey | null {
  if (section.endsWith("_transparency_required")) return "paper.sub.required";
  if (section.endsWith("_transparency_optional")) return "paper.sub.optional";
  return null;
}

// ---- rows from the server ---------------------------------------------------------------------------------------------------

export interface ExtraOptionRow {
  id: number;
  section: ExtraSection;
  code: string;
  name: string;
  description: string;
  price: string;
  priceUnit: ExtraPriceUnit;
  currency: string;
  colorHex: string;
  sortOrder: number;
  isActive: boolean;
}

export function parseExtraOption(raw: unknown): ExtraOptionRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;
  const id = Number(row.id);
  if (!Number.isInteger(id) || id <= 0 || !isExtraSection(row.section) || typeof row.code !== "string" || !row.code) return null;
  const minor = toMinor(row.price);
  const sort = Number(row.sort_order);
  return {
    id,
    section: row.section,
    code: row.code,
    name: typeof row.name === "string" ? row.name : row.code,
    description: typeof row.description === "string" ? row.description : "",
    price: fromMinor(minor ?? 0),
    priceUnit: isPriceUnit(row.price_unit) ? row.price_unit : "per_copy",
    currency: typeof row.currency === "string" ? row.currency : "SYP",
    colorHex: typeof row.color_hex === "string" ? row.color_hex : "",
    sortOrder: Number.isFinite(sort) && sort >= 0 ? Math.floor(sort) : 0,
    isActive: row.is_active !== false,
  };
}

/** One option as the owner sees it: the new-pound row and the dollar row that belong together (either may be missing). */
export interface OptionEntry {
  key: string;
  section: ExtraSection;
  code: string;
  name: string;
  description: string;
  priceUnit: ExtraPriceUnit;
  sortOrder: number;
  isActive: boolean;
  rows: Partial<Record<ExtraCurrency, ExtraOptionRow>>;
  /** Rows of other currencies the page does not edit; they are still switched / deleted with the entry. */
  otherRows: ExtraOptionRow[];
}

export function groupOptions(rows: readonly ExtraOptionRow[]): OptionEntry[] {
  const entries = new Map<string, OptionEntry>();
  for (const row of rows) {
    const key = `${row.section}::${row.code}`;
    let entry = entries.get(key);
    if (!entry) {
      entry = { key, section: row.section, code: row.code, name: row.name, description: row.description, priceUnit: row.priceUnit, sortOrder: row.sortOrder, isActive: row.isActive, rows: {}, otherRows: [] };
      entries.set(key, entry);
    }
    if (row.currency === "SYP" || row.currency === "USD") {
      entry.rows[row.currency] = row;
      // The new-pound row is the reference for what the entry looks like; the dollar row only fills what is missing.
      if (row.currency === "SYP" || !entry.rows.SYP) {
        entry.name = row.name;
        entry.description = row.description;
        entry.priceUnit = row.priceUnit;
        entry.sortOrder = row.sortOrder;
      }
    } else entry.otherRows.push(row);
    // An entry counts as on only when every one of its rows is on, so a half-switched pair is shown (and fixed) as off.
    entry.isActive = entry.isActive && row.isActive;
  }
  return [...entries.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ar"));
}

export function entriesOfSection(entries: readonly OptionEntry[], section: ExtraSection): OptionEntry[] {
  return entries.filter((entry) => entry.section === section);
}

export function entryRowIds(entry: OptionEntry): number[] {
  return [entry.rows.SYP, entry.rows.USD, ...entry.otherRows].flatMap((row) => (row ? [row.id] : []));
}

/** An option that is switched off while its price is still zero: the owner has to set a price before it can be switched on. */
export function needsPrice(entry: OptionEntry): boolean {
  if (entry.isActive) return false;
  const rows = [entry.rows.SYP, entry.rows.USD].filter((row): row is ExtraOptionRow => Boolean(row));
  return rows.length > 0 && rows.some((row) => (toMinor(row.price) ?? 0) <= 0);
}

/** Currencies the entry has no row for (a pair created by hand on the server may be incomplete). */
export function missingCurrencies(entry: OptionEntry): ExtraCurrency[] {
  return EXTRA_CURRENCIES.filter((currency) => !entry.rows[currency]);
}

type AmountProblem = "required" | "invalid" | "tooMany";

/** A non-negative amount with at most two decimals (the same rule as the counter form's price boxes). */
function amountProblem(text: string): AmountProblem | null {
  const trimmed = text.trim();
  if (!trimmed) return "required";
  if (!/^\d+(?:\.\d+)?$/u.test(trimmed)) return "invalid";
  return (trimmed.split(".")[1] ?? "").length > 2 ? "tooMany" : null;
}

// ---- dollar price from the pound price ----------------------------------------------------------------------------------------

/** The exchange rate (pounds per dollar) as a positive number, or null when it is missing or unusable. */
export function usableRate(rate: unknown): number | null {
  const number = typeof rate === "number" ? rate : typeof rate === "string" ? Number(rate) : Number.NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** Dollar price = pound price / rate, rounded half-up to cents ("75" at 120 -> "0.63"); null when either is unusable. */
export function usdFromSyp(syp: string, rate: unknown): string | null {
  const usable = usableRate(rate);
  const minor = amountProblem(syp) === null ? toMinor(syp) : null;
  if (usable === null || minor === null) return null;
  // minor is hundredths of a pound; dividing by the rate gives hundredths of a dollar.
  return fromMinor(Math.round((minor / usable)));
}

// ---- the edit form ------------------------------------------------------------------------------------------------------------

export interface OptionForm {
  section: ExtraSection;
  code: string;
  name: string;
  description: string;
  priceUnit: ExtraPriceUnit;
  sypPrice: string;
  usdPrice: string;
  /** The dollar price follows the pound price through the current exchange rate (only possible when the rate is known). */
  usdAuto: boolean;
  sortOrder: string;
  isActive: boolean;
}

export function emptyForm(section: ExtraSection, rate: unknown): OptionForm {
  return { section, code: "", name: "", description: "", priceUnit: "per_copy", sypPrice: "", usdPrice: "", usdAuto: usableRate(rate) !== null, sortOrder: "0", isActive: true };
}

export function formFromEntry(entry: OptionEntry, rate: unknown): OptionForm {
  const syp = entry.rows.SYP?.price ?? "";
  const usd = entry.rows.USD?.price ?? "";
  // Follow the rate only while the stored dollar price is exactly what the rate would give: a hand-typed price stays as typed.
  const auto = usableRate(rate) !== null && (syp === "" || usd === "" || usdFromSyp(syp, rate) === usd);
  return { section: entry.section, code: entry.code, name: entry.name, description: entry.description, priceUnit: entry.priceUnit, sypPrice: syp, usdPrice: usd, usdAuto: auto, sortOrder: String(entry.sortOrder), isActive: entry.isActive };
}

/** The dollar price that will be saved: from the rate while it follows it, else what the owner typed. */
export function effectiveUsd(form: OptionForm, rate: unknown): string {
  if (!form.usdAuto) return form.usdPrice;
  return usdFromSyp(form.sypPrice, rate) ?? "";
}

/** The server keeps 12 digits with 2 decimals (10 integer digits). */
const PRICE_MAX_MINOR = 999_999_999_999;

export interface OptionProblems {
  code?: "required" | "format" | "tooLong" | "taken";
  name?: "required" | "tooLong";
  description?: "tooLong";
  syp?: AmountProblem | "tooBig";
  usd?: AmountProblem | "tooBig";
  sort?: boolean;
}

function priceProblem(text: string): AmountProblem | "tooBig" | null {
  const problem = amountProblem(text);
  if (problem) return problem;
  const minor = toMinor(text);
  return minor !== null && minor > PRICE_MAX_MINOR ? "tooBig" : null;
}

export function optionProblems(form: OptionForm, rate: unknown, isNew: boolean, takenCodes: readonly string[] = []): OptionProblems {
  const problems: OptionProblems = {};
  const code = form.code.trim();
  if (isNew) {
    if (!code) problems.code = "required";
    else if (code.length > EXTRA_CODE_MAX) problems.code = "tooLong";
    else if (!/^[a-z0-9][a-z0-9_-]*$/u.test(code)) problems.code = "format";
    else if (takenCodes.includes(code)) problems.code = "taken";
  }
  const name = form.name.trim();
  if (!name) problems.name = "required";
  else if (name.length > EXTRA_NAME_MAX) problems.name = "tooLong";
  if (form.description.length > EXTRA_DESCRIPTION_MAX) problems.description = "tooLong";
  const syp = priceProblem(form.sypPrice);
  if (syp) problems.syp = syp;
  const usd = priceProblem(effectiveUsd(form, rate));
  if (usd) problems.usd = usd;
  const sort = Number(form.sortOrder);
  if (!/^\d{1,5}$/u.test(form.sortOrder.trim()) || sort > EXTRA_SORT_MAX) problems.sort = true;
  return problems;
}

export interface SaveRequest {
  method: "POST" | "PATCH" | "DELETE";
  path: string;
  body: Record<string, unknown>;
}

/**
 * The writes that save the form: for each of the two currencies the existing row is patched, or a missing row is created, so the
 * pair never drifts apart. Fields shared by both rows (name, unit, order, on/off) are written to both.
 */
export function saveRequests(form: OptionForm, entry: OptionEntry | null, rate: unknown): SaveRequest[] {
  const shared = {
    name: form.name.trim(),
    description: form.description.trim(),
    price_unit: form.priceUnit,
    sort_order: Number(form.sortOrder.trim() || 0),
    is_active: form.isActive,
  };
  const prices: Record<ExtraCurrency, string> = { SYP: form.sypPrice, USD: effectiveUsd(form, rate) };
  const requests: SaveRequest[] = EXTRA_CURRENCIES.map((currency) => {
    const price = fromMinor(toMinor(prices[currency]) ?? 0);
    const existing = entry?.rows[currency];
    if (existing) return { method: "PATCH", path: extraOptionPath(existing.id), body: { ...shared, price } };
    return { method: "POST", path: EXTRA_OPTIONS_PATH, body: { ...shared, price, section: form.section, code: entry?.code ?? form.code.trim(), currency } };
  });
  // Rows of any other currency keep their own price but follow the shared fields.
  for (const other of entry?.otherRows ?? []) requests.push({ method: "PATCH", path: extraOptionPath(other.id), body: shared });
  return requests;
}

/** Switch an entry on or off: one write per row. */
export function toggleRequests(entry: OptionEntry, isActive: boolean): SaveRequest[] {
  return entryRowIds(entry).map((id) => ({ method: "PATCH", path: extraOptionPath(id), body: { is_active: isActive } }));
}

export function deleteRequests(entry: OptionEntry): SaveRequest[] {
  return entryRowIds(entry).map((id) => ({ method: "DELETE", path: extraOptionPath(id), body: {} }));
}

// ---- what an order item carries ---------------------------------------------------------------------------------------------------

/** One paper option chosen on an order item, with the name and price as they were when the order was priced. */
export interface ItemExtra {
  section: ExtraSection;
  code: string;
  name: string;
  /** Price of the option in its unit; null when only the code is known (an order without a pricing snapshot). */
  price: string | null;
  priceUnit: ExtraPriceUnit | null;
  /** What the option adds to the item for all its copies; null when unknown. */
  cost: string | null;
}

function moneyText(value: unknown): string | null {
  const minor = toMinor(value);
  return minor === null ? null : fromMinor(minor);
}

/**
 * The paper options of an order item. The pricing snapshot (`pricing_snapshot.extras`) is the truth about what was charged, since the
 * catalog may have been edited since; the plain `extras` ({section: code}) is the fallback for an item without a snapshot.
 */
export function parseItemExtras(raw: Record<string, unknown>): ItemExtra[] {
  const snapshot = typeof raw.pricing_snapshot === "object" && raw.pricing_snapshot !== null ? (raw.pricing_snapshot as Record<string, unknown>) : {};
  const lines: ItemExtra[] = [];
  if (Array.isArray(snapshot.extras)) {
    for (const entry of snapshot.extras) {
      if (typeof entry !== "object" || entry === null) continue;
      const line = entry as Record<string, unknown>;
      if (!isExtraSection(line.section) || typeof line.code !== "string") continue;
      lines.push({
        section: line.section,
        code: line.code,
        name: typeof line.name === "string" && line.name.trim() ? line.name.trim() : line.code,
        price: moneyText(line.price),
        priceUnit: isPriceUnit(line.price_unit) ? line.price_unit : null,
        cost: moneyText(line.cost),
      });
    }
  } else if (typeof raw.extras === "object" && raw.extras !== null && !Array.isArray(raw.extras)) {
    for (const [section, code] of Object.entries(raw.extras as Record<string, unknown>)) {
      if (isExtraSection(section) && typeof code === "string" && code) lines.push({ section, code, name: code, price: null, priceUnit: null, cost: null });
    }
  }
  return lines.sort((a, b) => EXTRA_SECTIONS.indexOf(a.section) - EXTRA_SECTIONS.indexOf(b.section));
}

/** Total the paper options add to the item (`extras_price`, else the snapshot's); null when the item has none. */
export function parseItemExtrasPrice(raw: Record<string, unknown>): string | null {
  const snapshot = typeof raw.pricing_snapshot === "object" && raw.pricing_snapshot !== null ? (raw.pricing_snapshot as Record<string, unknown>) : {};
  const minor = toMinor(raw.extras_price ?? snapshot.extras_price);
  return minor !== null && minor > 0 ? fromMinor(minor) : null;
}

// ---- the choices offered at the counter -----------------------------------------------------------------------------------------

export interface ShopExtraOption { code: string; name: string; description: string; price: string; priceUnit: ExtraPriceUnit }
export interface ShopExtraSection { section: ExtraSection; label: string; options: ShopExtraOption[] }

/** `extras` of GET /printing/options/: only the sections that have something to choose, in the order form's order. */
export function parseShopExtras(raw: unknown): ShopExtraSection[] {
  if (!Array.isArray(raw)) return [];
  const sections: ShopExtraSection[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const block = entry as Record<string, unknown>;
    if (!isExtraSection(block.section) || !Array.isArray(block.options)) continue;
    const options = block.options.flatMap((option): ShopExtraOption[] => {
      if (typeof option !== "object" || option === null) return [];
      const row = option as Record<string, unknown>;
      if (typeof row.code !== "string" || !row.code) return [];
      return [{
        code: row.code,
        name: typeof row.name === "string" && row.name ? row.name : row.code,
        description: typeof row.description === "string" ? row.description : "",
        price: moneyText(row.price) ?? "0.00",
        priceUnit: isPriceUnit(row.price_unit) ? row.price_unit : "per_copy",
      }];
    });
    if (options.length) sections.push({ section: block.section, label: typeof block.label === "string" ? block.label : block.section, options });
  }
  return sections.sort((a, b) => EXTRA_SECTIONS.indexOf(a.section) - EXTRA_SECTIONS.indexOf(b.section));
}

/** `{section: code}` as the server wants it: only known sections with a chosen code. */
export function extrasBody(extras: Readonly<Record<string, string>>): Record<string, string> {
  const body: Record<string, string> = {};
  for (const section of EXTRA_SECTIONS) {
    const code = extras[section];
    if (typeof code === "string" && code) body[section] = code;
  }
  return body;
}

/** Sets or clears (empty code) the choice of one section without touching the others. */
export function withExtra(extras: Readonly<Record<string, string>>, section: ExtraSection, code: string): Record<string, string> {
  const next = { ...extras };
  if (code) next[section] = code;
  else delete next[section];
  return next;
}

/**
 * What the chosen paper options add to a counter line for all its copies, worked out from the catalog like the server does
 * (per copy: price x copies; per 50 sheets: price x ceil(sheets of one copy / 50) x copies; per sheet: price x sheets of one copy x copies).
 * `sheetsAllCopies` is the quote line's sheet count. Null when nothing is chosen or the sheets are unknown. Display only: the server prices the order.
 */
export function estimateExtrasCost(chosen: Readonly<Record<string, string>>, sections: readonly ShopExtraSection[], copies: number, sheetsAllCopies: number): string | null {
  if (!Number.isInteger(copies) || copies < 1 || !Number.isFinite(sheetsAllCopies) || sheetsAllCopies < 0) return null;
  const sheetsInCopy = Math.ceil(sheetsAllCopies / copies);
  let total = 0;
  let any = false;
  for (const section of sections) {
    const option = section.options.find((candidate) => candidate.code === chosen[section.section]);
    const minor = option ? toMinor(option.price) : null;
    if (!option || minor === null) continue;
    any = true;
    const units = option.priceUnit === "per_50_sheets" ? Math.ceil(sheetsInCopy / 50) : option.priceUnit === "per_sheet" ? sheetsInCopy : 1;
    total += minor * units * copies;
  }
  return any && total > 0 ? fromMinor(total) : null;
}
