/** Layout of the printing workspace: which tabs exist and how the address (`?tab=`, `?section=`) selects them. */

export const PRINTING_TABS = ["orders", "queue", "counter", "catalog", "printers", "locations"] as const;
export type PrintingTab = (typeof PRINTING_TABS)[number];

export const CATALOG_SECTIONS = ["pricing", "binding", "covers", "wire", "products", "simulator"] as const;
export type CatalogSection = (typeof CATALOG_SECTIONS)[number];

export function resolveTab(value: string | null | undefined): PrintingTab {
  return (PRINTING_TABS as readonly string[]).includes(value ?? "") ? (value as PrintingTab) : "orders";
}

export function resolveSection(value: string | null | undefined): CatalogSection {
  return (CATALOG_SECTIONS as readonly string[]).includes(value ?? "") ? (value as CatalogSection) : "pricing";
}

/** The order to copy into the counter form (`?from=<id>`), or null. */
export function resolveCopyFrom(value: string | null | undefined): number | null {
  return /^\d{1,9}$/u.test(value ?? "") && Number(value) > 0 ? Number(value) : null;
}

/** Address of a tab with its own parameters; other tabs' parameters are never carried over. */
export function tabHref(locale: string, tab: PrintingTab, params: Record<string, string | number> = {}): string {
  const query = new URLSearchParams({ tab, ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])) });
  return `/${locale}/dashboard/printing?${query}`;
}
