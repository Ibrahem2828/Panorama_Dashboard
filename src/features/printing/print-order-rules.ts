export type ColorMode = "black_white" | "color";
export type PaperSize = "A5" | "A4" | "A3";
export type Sides = "one_sided" | "double_sided";
export type Binding = "none" | "staple" | "spiral" | "thermal";

/** One print order item as the cashier works with it. Every field is checked: the API list type is `unknown[]`. */
export interface OrderItemView {
  id: number | string;
  fileName: string;
  copies: number;
  /** Pages of one copy; null when the server has not counted them. */
  pages: number | null;
  /** Physical sheets for ALL copies (the server counts a double-sided sheet once for two pages). */
  sheets: number | null;
  colorMode: ColorMode;
  paperSize: PaperSize;
  sides: Sides;
  binding: Binding;
  price: string | null;
}

const COLOR_MODES: readonly ColorMode[] = ["black_white", "color"];
const PAPER_SIZES: readonly PaperSize[] = ["A5", "A4", "A3"];
const SIDES: readonly Sides[] = ["one_sided", "double_sided"];
const BINDINGS: readonly Binding[] = ["none", "staple", "spiral", "thermal"];

function oneOf<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function count(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseOrderItems(raw: unknown): OrderItemView[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry, index): OrderItemView[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const item = entry as Record<string, unknown>;
    const copies = count(item.copies);
    return [{
      id: typeof item.id === "number" || typeof item.id === "string" ? item.id : `row-${index}`,
      fileName: text(item.original_file_name) || text(item.source_file_title),
      copies: copies && copies > 0 ? copies : 1,
      pages: count(item.pages_count),
      sheets: count(item.sheets_count),
      colorMode: oneOf(COLOR_MODES, item.color_mode, "black_white"),
      paperSize: oneOf(PAPER_SIZES, item.paper_size, "A4"),
      sides: oneOf(SIDES, item.sides, "one_sided"),
      binding: oneOf(BINDINGS, item.binding, "none"),
      price: typeof item.price === "string" || typeof item.price === "number" ? String(item.price) : null,
    }];
  });
}

// ---- preview geometry -------------------------------------------------------------------------------------------------------------

/** Width of each paper size relative to A4 (A5 is half a sheet, A3 two). All A sizes share the 1 : sqrt(2) shape. */
const WIDTH_SCALE: Record<PaperSize, number> = { A5: 0.71, A4: 1, A3: 1.41 };
export const MAX_VISIBLE_COPIES = 4;
const A3_DRAW_WIDTH = 128;

export interface PreviewModel {
  sheetWidth: number;
  sheetHeight: number;
  /** Sheets drawn behind the front one (one per extra copy, capped). */
  stackDepth: number;
  colored: boolean;
  doubleSided: boolean;
  binding: Binding;
}

export function buildPreview(item: Pick<OrderItemView, "paperSize" | "colorMode" | "sides" | "binding" | "copies">): PreviewModel {
  const width = Math.round((A3_DRAW_WIDTH * WIDTH_SCALE[item.paperSize]) / WIDTH_SCALE.A3);
  return {
    sheetWidth: width,
    sheetHeight: Math.round(width * Math.SQRT2),
    stackDepth: Math.min(Math.max(1, item.copies), MAX_VISIBLE_COPIES) - 1,
    colored: item.colorMode === "color",
    doubleSided: item.sides === "double_sided",
    binding: item.binding,
  };
}

/** Coil loops along a spiral-bound edge (about one every 9 units, never fewer than four). */
export function spiralRingCount(sheetHeight: number): number {
  return Math.max(4, Math.floor((sheetHeight - 12) / 9));
}

// ---- preparation checklist --------------------------------------------------------------------------------------------------------

export interface PaperNeed { paperSize: PaperSize; colorMode: ColorMode; sheets: number }
export interface BindingNeed { binding: Exclude<Binding, "none">; units: number }

export interface PrepSummary {
  paper: PaperNeed[];
  bindings: BindingNeed[];
  totalSheets: number;
  totalCopies: number;
  /** True when at least one item has no sheet count, so the paper totals may be short. */
  incomplete: boolean;
}

/**
 * What the cashier must take from the shelf: sheets per paper size and ink type, and one bound unit per copy for each
 * binding type. Items the server has not counted yet are flagged instead of being guessed.
 */
export function summarizePrep(items: readonly OrderItemView[]): PrepSummary {
  const paper = new Map<string, PaperNeed>();
  const bindings = new Map<string, BindingNeed>();
  let totalSheets = 0;
  let totalCopies = 0;
  let incomplete = false;
  for (const item of items) {
    totalCopies += item.copies;
    if (item.sheets === null) incomplete = true;
    else {
      totalSheets += item.sheets;
      const key = `${item.paperSize}|${item.colorMode}`;
      const existing = paper.get(key);
      if (existing) existing.sheets += item.sheets;
      else paper.set(key, { paperSize: item.paperSize, colorMode: item.colorMode, sheets: item.sheets });
    }
    if (item.binding !== "none") {
      const existing = bindings.get(item.binding);
      if (existing) existing.units += item.copies;
      else bindings.set(item.binding, { binding: item.binding, units: item.copies });
    }
  }
  const sizeOrder: Record<PaperSize, number> = { A3: 0, A4: 1, A5: 2 };
  return {
    paper: [...paper.values()].sort((a, b) => sizeOrder[a.paperSize] - sizeOrder[b.paperSize] || a.colorMode.localeCompare(b.colorMode)),
    bindings: [...bindings.values()].sort((a, b) => a.binding.localeCompare(b.binding)),
    totalSheets,
    totalCopies,
    incomplete,
  };
}

/** The checklist progress, counting only ids that still exist in the order. */
export function prepProgress(items: readonly OrderItemView[], done: ReadonlySet<string>): { done: number; total: number } {
  const ids = new Set(items.map((item) => String(item.id)));
  let finished = 0;
  for (const id of done) if (ids.has(id)) finished += 1;
  return { done: finished, total: ids.size };
}

// ---- counted nouns ----------------------------------------------------------------------------------------------------------------

export type CountedUnit = "copies" | "pages" | "sheets" | "bound";

type Forms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/** Arabic has six plural forms (1, 2, 3-10, 11-99, ...): "6 صفحات" but "12 صفحة". English only needs one/other. */
const UNIT_FORMS: Record<"ar" | "en", Record<CountedUnit, Forms>> = {
  ar: {
    copies: { one: "نسخة", two: "نسختان", few: "نسخ", many: "نسخة", other: "نسخة" },
    pages: { one: "صفحة", two: "صفحتان", few: "صفحات", many: "صفحة", other: "صفحة" },
    sheets: { one: "ورقة", two: "ورقتان", few: "أوراق", many: "ورقة", other: "ورقة" },
    bound: { one: "نسخة مجلّدة", two: "نسختان مجلّدتان", few: "نسخ مجلّدة", many: "نسخة مجلّدة", other: "نسخة مجلّدة" },
  },
  en: {
    copies: { one: "copy", other: "copies" },
    pages: { one: "page", other: "pages" },
    sheets: { one: "sheet", other: "sheets" },
    bound: { one: "bound copy", other: "bound copies" },
  },
};

/** "3 نسخ", "1 page": the number followed by the noun in the right plural form for the locale. */
export function countLabel(locale: string, count: number, unit: CountedUnit): string {
  const language = locale === "ar" ? "ar" : "en";
  const category = new Intl.PluralRules(language).select(count);
  const forms = UNIT_FORMS[language][unit];
  return `${count} ${forms[category] ?? forms.other}`;
}
