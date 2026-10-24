/**
 * Print-dialog options as the cashier sees them on an order: what was asked (pages per sheet, two-sided and which edge, orientation,
 * page range, collation) and the drawing data for the sheet simulation. Mirrors `apps/printing/options.py`; the server prices and prepares
 * the file, this only reads and draws what the customer ordered.
 */

export type DuplexFlip = "long_edge" | "short_edge";
export type Orientation = "auto" | "portrait" | "landscape";
export type NUpDirection = "ltr" | "rtl";

export interface ItemOptions {
  pagesPerSheet: number;
  duplexFlip: DuplexFlip;
  orientation: Orientation;
  nUpDirection: NUpDirection;
  pageRange: string;
  /** Pages of one copy that are printed (after the page range). */
  selectedPages: number | null;
  collate: boolean;
  cover: string;
  /** Spiral wire weight for one copy, from the shop's table (null when not set / not a spiral binding). */
  wireGrams: string | null;
  bindingKind: string;
  productName: string;
}

const PAGES_PER_SHEET = [1, 2, 4, 6, 9, 16];

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function oneOf<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function parseItemOptions(raw: Record<string, unknown>): ItemOptions {
  const snapshot = typeof raw.pricing_snapshot === "object" && raw.pricing_snapshot !== null ? (raw.pricing_snapshot as Record<string, unknown>) : {};
  const perSheet = Number(raw.pages_per_sheet);
  const selected = Number(raw.selected_pages);
  return {
    pagesPerSheet: PAGES_PER_SHEET.includes(perSheet) ? perSheet : 1,
    duplexFlip: oneOf(["long_edge", "short_edge"] as const, raw.duplex_flip, "long_edge"),
    orientation: oneOf(["auto", "portrait", "landscape"] as const, raw.orientation, "auto"),
    nUpDirection: oneOf(["ltr", "rtl"] as const, raw.n_up_direction, "ltr"),
    pageRange: text(raw.page_range),
    selectedPages: Number.isFinite(selected) && selected > 0 ? Math.floor(selected) : null,
    collate: raw.collate !== false,
    cover: text(raw.cover),
    wireGrams: text(snapshot.wire_grams_per_copy) || null,
    bindingKind: text(snapshot.binding_kind),
    productName: raw.product ? text(raw.original_file_name) : "",
  };
}

export interface Grid { columns: number; rows: number; landscape: boolean }

const PORTRAIT_GRID: Record<number, readonly [number, number]> = { 1: [1, 1], 2: [1, 2], 4: [2, 2], 6: [2, 3], 9: [3, 3], 16: [4, 4] };

export function sheetGrid(pagesPerSheet: number, orientation: Orientation): Grid {
  const [c, r] = PORTRAIT_GRID[pagesPerSheet] ?? [1, 1];
  const landscape = orientation === "landscape" || (orientation === "auto" && (pagesPerSheet === 2 || pagesPerSheet === 6));
  if (pagesPerSheet === 1) return { columns: 1, rows: 1, landscape };
  return landscape ? { columns: Math.max(c, r), rows: Math.min(c, r), landscape } : { columns: Math.min(c, r), rows: Math.max(c, r), landscape };
}

export function sheetsPerCopy(selectedPages: number, pagesPerSheet: number, doubleSided: boolean): number {
  if (selectedPages <= 0) return 0;
  const faces = Math.max(Math.ceil(selectedPages / pagesPerSheet), 1);
  return doubleSided ? Math.ceil(faces / 2) : faces;
}

/** Page numbers in each cell of one face, row by row; null cells are empty. A right-to-left grid fills each row from the right. */
export function faceCells(pages: number[], grid: Grid, direction: NUpDirection): (number | null)[] {
  const cells: (number | null)[] = Array.from({ length: grid.columns * grid.rows }, () => null);
  pages.slice(0, cells.length).forEach((page, index) => {
    const row = Math.floor(index / grid.columns);
    const column = index % grid.columns;
    cells[row * grid.columns + (direction === "rtl" ? grid.columns - 1 - column : column)] = page;
  });
  return cells;
}

/** The printer settings the cashier should choose in the print dialog so the paper comes out as ordered. */
export function printerSettings(item: { sides: string; colorMode: string; paperSize: string }, options: ItemOptions): {
  duplex: "off" | "long_edge" | "short_edge";
  color: "color" | "mono";
  paper: string;
  copies: 1;
} {
  return {
    duplex: item.sides === "double_sided" ? (options.duplexFlip === "short_edge" ? "short_edge" : "long_edge") : "off",
    color: item.colorMode === "color" ? "color" : "mono",
    paper: item.paperSize,
    /** The print-ready file already contains every copy in the right order: the printer prints it ONCE. */
    copies: 1,
  };
}
