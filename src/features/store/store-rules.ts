import type { MessageKey } from "@/i18n/messages";

/**
 * Pure rules of the stationery-store screens (orders desk, catalogue, reviews, summary): API paths, the order status
 * flow, price and stock validation, image address mapping and the request bodies. No React in here, so every rule can be
 * tested on its own (tests/unit/store-rules.test.ts).
 */

export const STORE_API = "/api/v1/dashboard/store";

export type StoreResource = "brands" | "categories" | "products" | "variants" | "images" | "orders" | "reviews";

/** `/api/v1/dashboard/store/<resource>/[id/][action/]` (every backend route ends with a slash). */
export function storePath(resource: StoreResource | "summary", id?: number | string, action?: string): string {
  const parts = [STORE_API, resource];
  if (id !== undefined) parts.push(encodeURIComponent(String(id)));
  if (action) parts.push(action);
  return `${parts.join("/")}/`;
}

export const CURRENCIES = ["SYP", "USD"] as const;
export type StoreCurrency = (typeof CURRENCIES)[number];

// ---- order status flow --------------------------------------------------------------------------------------------------

export const ORDER_STATUSES = ["pending", "confirmed", "ready_for_pickup", "picked_up", "cancelled"] as const;
export type StoreOrderStatus = (typeof ORDER_STATUSES)[number];

/** Mirror of the backend `STORE_TRANSITIONS`; the server is still the judge (`409 INVALID_TRANSITION`). */
const TRANSITIONS: Readonly<Record<StoreOrderStatus, readonly StoreOrderStatus[]>> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["ready_for_pickup", "cancelled"],
  ready_for_pickup: ["picked_up", "cancelled"],
  picked_up: [],
  cancelled: [],
};

export function isOrderStatus(value: unknown): value is StoreOrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

/** Statuses an order in `current` may move to. Unknown or final statuses allow nothing. */
export function allowedTransitions(current: string): readonly StoreOrderStatus[] {
  return isOrderStatus(current) ? TRANSITIONS[current] : [];
}

export function canTransition(current: string, next: string): boolean {
  return (allowedTransitions(current) as readonly string[]).includes(next);
}

export function isFinalStatus(status: string): boolean {
  return isOrderStatus(status) && TRANSITIONS[status].length === 0;
}

/** The single "next step" button of an order (confirm, then ready, then picked up); null when the flow is over. */
export function forwardStatus(current: string): Exclude<StoreOrderStatus, "pending" | "cancelled"> | null {
  const next = allowedTransitions(current).find((status) => status !== "cancelled");
  return (next as Exclude<StoreOrderStatus, "pending" | "cancelled"> | undefined) ?? null;
}

export function canCancelOrder(current: string): boolean {
  return canTransition(current, "cancelled");
}

export function statusLabelKey(status: string): MessageKey {
  return (isOrderStatus(status) ? `store.status.${status}` : "store.status.unknown") as MessageKey;
}

/** Action-button wording of a move (the verb, not the resulting state). */
export function actionLabelKey(next: StoreOrderStatus): MessageKey {
  return `store.action.${next}` as MessageKey;
}

export type StatusTone = "warning" | "info" | "success" | "muted" | "danger";

export function statusTone(status: string): StatusTone {
  switch (status) {
    case "pending": return "warning";
    case "confirmed": return "info";
    case "ready_for_pickup": return "success";
    case "picked_up": return "muted";
    case "cancelled": return "danger";
    default: return "muted";
  }
}

/** Orders waiting for staff attention (new or being prepared): what the badge and the tab counters stress. */
export function isOpenStatus(status: string): boolean {
  return status === "pending" || status === "confirmed" || status === "ready_for_pickup";
}

export interface HistoryEntry {
  old_status: string;
  new_status: string;
  note: string;
  created_at: string;
}

/** The status trail oldest first (the API may return it in any order), entries without a date go last. */
export function sortedHistory(history: readonly HistoryEntry[] | null | undefined): HistoryEntry[] {
  return [...(history ?? [])].sort((a, b) => {
    const left = Date.parse(a.created_at);
    const right = Date.parse(b.created_at);
    return (Number.isNaN(left) ? Infinity : left) - (Number.isNaN(right) ? Infinity : right);
  });
}

// ---- server errors in plain words ---------------------------------------------------------------------------------------

/** Backend error codes of the store and the sentence key that explains each one. */
const ERROR_KEYS: Readonly<Record<string, MessageKey>> = {
  INVALID_TRANSITION: "store.error.INVALID_TRANSITION",
  IN_USE: "store.error.IN_USE",
  INSUFFICIENT_STOCK: "store.error.INSUFFICIENT_STOCK",
  ORDER_NOT_CANCELLABLE: "store.error.ORDER_NOT_CANCELLABLE",
  VALIDATION_ERROR: "store.error.VALIDATION_ERROR",
};

/** The localized sentence of a store error code, or null so the caller falls back to the generic HTTP message. */
export function storeErrorKey(code: unknown): MessageKey | null {
  return typeof code === "string" ? ERROR_KEYS[code.toUpperCase()] ?? null : null;
}

// ---- prices -------------------------------------------------------------------------------------------------------------

const PRICE_MAX = 9_999_999_999.99;

/** What is wrong with a typed price: blank is fine (not sold in this currency), otherwise a positive number with up to 2 decimals. */
export function priceProblem(raw: string): "invalid" | "tooMany" | "nonPositive" | "tooLarge" | null {
  const text = raw.trim();
  if (text === "") return null;
  if (!/^\d+(\.\d+)?$/u.test(text)) return "invalid";
  if ((text.split(".")[1]?.length ?? 0) > 2) return "tooMany";
  const value = Number(text);
  if (!(value > 0)) return "nonPositive";
  return value > PRICE_MAX ? "tooLarge" : null;
}

/** A typed price as the API wants it: a trimmed decimal string, or null (not sold in this currency). */
export function priceValue(raw: string): string | null {
  const text = raw.trim();
  return text === "" ? null : text;
}

/** The price the customer pays for a variant: its own price, else the product's base price in that currency. */
export function effectivePrice(variantPrice: string | null | undefined, productPrice: string | null | undefined): string | null {
  return variantPrice ?? productPrice ?? null;
}

const HEX_COLOUR = /^#[0-9A-Fa-f]{6}$/u;

export function isHexColour(value: string): boolean {
  return HEX_COLOUR.test(value);
}

// ---- images -------------------------------------------------------------------------------------------------------------

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGES_ACCEPT = IMAGE_TYPES.join(",");

export function imageProblem(file: { type: string; size: number }): "type" | "size" | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return "type";
  if (file.size <= 0 || file.size > IMAGE_MAX_BYTES) return "size";
  return null;
}

const IMAGE_PATH = /^\/api\/v1\/store\/(images|brands)\/(\d{1,12})\/(logo\/)?$/u;
const VERSION = /^[0-9A-Za-z_-]{1,32}$/u;

/**
 * Same-origin address of a store picture. The backend serves pictures only to signed-in people (a Bearer token, no public
 * /media/), and a browser <img> cannot send the token, so the picture goes through the BFF proxy, which adds the session
 * token. Accepts the absolute or relative URL of the payload and keeps the `?v=` cache buster and `variant=thumb`.
 * Anything that is not a store picture path maps to null (nothing foreign is ever loaded).
 */
export function storeImageSrc(backendUrl: string | null | undefined): string | null {
  if (!backendUrl) return null;
  let parsed: URL;
  try {
    parsed = new URL(backendUrl, "http://placeholder.invalid");
  } catch {
    return null;
  }
  const match = IMAGE_PATH.exec(parsed.pathname);
  if (!match) return null;
  const isImage = match[1] === "images";
  if (isImage === Boolean(match[3])) return null; // images/<id>/ has no suffix, brands/<id>/ needs logo/
  const query = new URLSearchParams();
  const version = parsed.searchParams.get("v") ?? "";
  if (VERSION.test(version)) query.set("v", version);
  if (isImage && parsed.searchParams.get("variant") === "thumb") query.set("variant", "thumb");
  const base = `/api/backend${parsed.pathname}`;
  const suffix = query.toString();
  return suffix ? `${base}?${suffix}` : base;
}

export interface ProductImage {
  id: number;
  product: number;
  variant: number | null;
  url: string;
  thumb_url: string;
  alt_text: string;
  sort_order: number;
  is_primary: boolean;
}

/** Gallery order: primary first, then the staff's sort order, then oldest first. */
export function orderedImages<T extends Pick<ProductImage, "id" | "sort_order" | "is_primary">>(images: readonly T[]): T[] {
  return [...images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order || a.id - b.id);
}

/** New sort values after dragging one picture to another's place: `[id, sort_order]` pairs for the pictures that changed. */
export function reorderImages(ids: readonly number[], moved: number, target: number): [number, number][] {
  const from = ids.indexOf(moved);
  const to = ids.indexOf(target);
  if (from < 0 || to < 0 || from === to) return [];
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, moved);
  const changed: [number, number][] = [];
  next.forEach((id, index) => { if (ids[index] !== id) changed.push([id, index]); });
  return changed;
}

/** The sort value of a picture that is appended after the existing ones. */
export function nextImageSort(images: readonly Pick<ProductImage, "sort_order">[]): number {
  return images.reduce((highest, image) => Math.max(highest, image.sort_order), -1) + 1;
}

/** Multipart fields of an image upload. `is_primary` and `alt_text` are always sent: an absent boolean is stored as false. */
export function imageUploadFields(input: { product: number; variant?: number | null; altText?: string; sortOrder: number; isPrimary: boolean }): [string, string][] {
  const fields: [string, string][] = [
    ["product", String(input.product)],
    ["alt_text", (input.altText ?? "").trim().slice(0, 150)],
    ["sort_order", String(Math.max(0, Math.trunc(input.sortOrder)))],
    ["is_primary", input.isPrimary ? "true" : "false"],
  ];
  if (input.variant) fields.push(["variant", String(input.variant)]);
  return fields;
}

// ---- brand --------------------------------------------------------------------------------------------------------------

export const BRAND_NAME_MAX = 100;
export const SORT_MAX = 32767;

export interface BrandForm { name: string; sortOrder: string; isActive: boolean }
export type LogoChange = { kind: "keep" } | { kind: "remove" } | { kind: "replace"; file: File };

export const EMPTY_BRAND: BrandForm = { name: "", sortOrder: "0", isActive: true };

export function sortProblem(raw: string): "invalid" | null {
  const text = raw.trim();
  if (text === "") return null;
  return /^\d+$/u.test(text) && Number(text) <= SORT_MAX ? null : "invalid";
}

export function sortValue(raw: string): number {
  const text = raw.trim();
  return text === "" ? 0 : Number(text);
}

export function validateBrand(form: BrandForm): Record<string, string> {
  const problems: Record<string, string> = {};
  const name = form.name.trim();
  if (!name) problems.name = "required";
  else if (name.length > BRAND_NAME_MAX) problems.name = "tooLong";
  if (sortProblem(form.sortOrder)) problems.sortOrder = "invalid";
  return problems;
}

export function brandFields(form: BrandForm): { name: string; sort_order: number; is_active: boolean } {
  return { name: form.name.trim(), sort_order: sortValue(form.sortOrder), is_active: form.isActive };
}

/** Multipart entries when the logo changes (an empty `logo` removes it); null when plain JSON is enough. */
export function brandMultipart(form: BrandForm, change: LogoChange): [string, string | File][] | null {
  if (change.kind === "keep") return null;
  const fields = brandFields(form);
  return [
    ["name", fields.name], ["sort_order", String(fields.sort_order)], ["is_active", fields.is_active ? "true" : "false"],
    ["logo", change.kind === "replace" ? change.file : ""],
  ];
}

// ---- category -----------------------------------------------------------------------------------------------------------

export const CATEGORY_NAME_MAX = 100;
export const CATEGORY_SLUG_MAX = 60;
const SLUG = /^[-a-zA-Z0-9_]+$/u;

export interface CategoryForm { name: string; slug: string; sortOrder: string; isActive: boolean }
export const EMPTY_CATEGORY: CategoryForm = { name: "", slug: "", sortOrder: "0", isActive: true };

/** A slug suggestion from a Latin name ("Ball pens" -> "ball-pens"); empty for an Arabic name (the staff types one). */
export function suggestSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, CATEGORY_SLUG_MAX);
}

export function validateCategory(form: CategoryForm): Record<string, string> {
  const problems: Record<string, string> = {};
  const name = form.name.trim();
  if (!name) problems.name = "required";
  else if (name.length > CATEGORY_NAME_MAX) problems.name = "tooLong";
  const slug = form.slug.trim();
  if (!slug) problems.slug = "required";
  else if (slug.length > CATEGORY_SLUG_MAX) problems.slug = "tooLong";
  else if (!SLUG.test(slug)) problems.slug = "invalid";
  if (sortProblem(form.sortOrder)) problems.sortOrder = "invalid";
  return problems;
}

export function categoryFields(form: CategoryForm): { name: string; slug: string; sort_order: number; is_active: boolean } {
  return { name: form.name.trim(), slug: form.slug.trim(), sort_order: sortValue(form.sortOrder), is_active: form.isActive };
}

// ---- product ------------------------------------------------------------------------------------------------------------

export const PRODUCT_NAME_MAX = 150;
export const SPEC_MAX_ROWS = 20;
export const SPEC_LABEL_MAX = 60;
export const SPEC_VALUE_MAX = 200;

export interface SpecRow { label: string; value: string }
export interface ProductForm {
  name: string;
  description: string;
  brand: string;
  category: string;
  specs: SpecRow[];
  priceSyp: string;
  priceUsd: string;
  isActive: boolean;
  sortOrder: string;
}

export const EMPTY_PRODUCT: ProductForm = { name: "", description: "", brand: "", category: "", specs: [], priceSyp: "", priceUsd: "", isActive: true, sortOrder: "0" };

/** Spec rows that were left completely blank are dropped; a half-filled row stays so validation can point at it. */
export function cleanSpecs(rows: readonly SpecRow[]): SpecRow[] {
  return rows.filter((row) => row.label.trim() !== "" || row.value.trim() !== "").map((row) => ({ label: row.label.trim(), value: row.value.trim() }));
}

export function validateProduct(form: ProductForm): Record<string, string> {
  const problems: Record<string, string> = {};
  const name = form.name.trim();
  if (!name) problems.name = "required";
  else if (name.length > PRODUCT_NAME_MAX) problems.name = "tooLong";
  if (!form.category) problems.category = "required";
  const syp = priceProblem(form.priceSyp);
  if (syp) problems.priceSyp = syp;
  const usd = priceProblem(form.priceUsd);
  if (usd) problems.priceUsd = usd;
  if (sortProblem(form.sortOrder)) problems.sortOrder = "invalid";
  const specs = cleanSpecs(form.specs);
  if (specs.length > SPEC_MAX_ROWS) problems.specs = "tooMany";
  else if (specs.some((row) => !row.label || !row.value)) problems.specs = "incomplete";
  else if (specs.some((row) => row.label.length > SPEC_LABEL_MAX || row.value.length > SPEC_VALUE_MAX)) problems.specs = "tooLong";
  return problems;
}

export function productBody(form: ProductForm): Record<string, unknown> {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    brand: form.brand ? Number(form.brand) : null,
    category: Number(form.category),
    specs: cleanSpecs(form.specs),
    price_syp: priceValue(form.priceSyp),
    price_usd: priceValue(form.priceUsd),
    is_active: form.isActive,
    sort_order: sortValue(form.sortOrder),
  };
}

/** A product with no price in any currency cannot be bought: the editor warns (it is allowed while a product is being prepared). */
export function hasNoPrice(form: Pick<ProductForm, "priceSyp" | "priceUsd">): boolean {
  return priceValue(form.priceSyp) === null && priceValue(form.priceUsd) === null;
}

// ---- variant ------------------------------------------------------------------------------------------------------------

export const SKU_MAX = 64;
export const VARIANT_LABEL_MAX = 50;
export const STOCK_MAX = 100_000;
export const MAX_PER_ORDER_MAX = 32767;

export interface VariantForm {
  sku: string;
  colourName: string;
  colourHex: string;
  sizeLabel: string;
  priceSyp: string;
  priceUsd: string;
  maxPerOrder: string;
  isActive: boolean;
  sortOrder: string;
  initialStock: string;
  reorderLevel: string;
}

export const EMPTY_VARIANT: VariantForm = {
  sku: "", colourName: "", colourHex: "", sizeLabel: "", priceSyp: "", priceUsd: "", maxPerOrder: "", isActive: true, sortOrder: "0", initialStock: "0", reorderLevel: "0",
};

function wholeNumberProblem(raw: string, max: number, min = 0): "invalid" | null {
  const text = raw.trim();
  if (text === "") return null;
  return /^\d+$/u.test(text) && Number(text) >= min && Number(text) <= max ? null : "invalid";
}

export function validateVariant(form: VariantForm, creating: boolean): Record<string, string> {
  const problems: Record<string, string> = {};
  if (form.sku.trim().length > SKU_MAX) problems.sku = "tooLong";
  if (form.colourName.trim().length > VARIANT_LABEL_MAX) problems.colourName = "tooLong";
  if (form.sizeLabel.trim().length > VARIANT_LABEL_MAX) problems.sizeLabel = "tooLong";
  if (form.colourHex.trim() !== "" && !isHexColour(form.colourHex.trim())) problems.colourHex = "invalid";
  const syp = priceProblem(form.priceSyp);
  if (syp) problems.priceSyp = syp;
  const usd = priceProblem(form.priceUsd);
  if (usd) problems.priceUsd = usd;
  if (wholeNumberProblem(form.maxPerOrder, MAX_PER_ORDER_MAX, 1)) problems.maxPerOrder = "invalid";
  if (sortProblem(form.sortOrder)) problems.sortOrder = "invalid";
  if (creating && wholeNumberProblem(form.initialStock, STOCK_MAX)) problems.initialStock = "invalid";
  if (wholeNumberProblem(form.reorderLevel, STOCK_MAX)) problems.reorderLevel = "invalid";
  return problems;
}

/** A variant is identified by its colour and size; with neither and no SKU the product has one plain variant (still allowed). */
export function variantLabel(variant: { colour_name?: string; size_label?: string }): string {
  return [variant.colour_name, variant.size_label].map((part) => (part ?? "").trim()).filter(Boolean).join(" / ");
}

export function variantBody(form: VariantForm, product: number, creating: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    product,
    sku: form.sku.trim(),
    colour_name: form.colourName.trim(),
    colour_hex: form.colourHex.trim().toUpperCase(),
    size_label: form.sizeLabel.trim(),
    price_syp: priceValue(form.priceSyp),
    price_usd: priceValue(form.priceUsd),
    max_per_order: form.maxPerOrder.trim() === "" ? null : Number(form.maxPerOrder),
    is_active: form.isActive,
    sort_order: sortValue(form.sortOrder),
    reorder_level: form.reorderLevel.trim() === "" ? 0 : Number(form.reorderLevel),
  };
  if (creating) body.initial_stock = form.initialStock.trim() === "" ? 0 : Number(form.initialStock);
  return body;
}

// ---- stock --------------------------------------------------------------------------------------------------------------

export const STOCK_MOVEMENTS = ["purchase", "adjustment", "waste"] as const;
export type StockMovement = (typeof STOCK_MOVEMENTS)[number];
export const STOCK_NOTE_MAX = 255;

export function movementLabelKey(type: StockMovement): MessageKey {
  return `store.stock.type.${type}` as MessageKey;
}

/** The signed quantity the shelf changes by: a purchase adds, waste removes, an adjustment is signed as typed. */
export function stockDelta(type: StockMovement, quantity: number): number {
  if (type === "purchase") return Math.abs(quantity);
  if (type === "waste") return -Math.abs(quantity);
  return quantity;
}

/** `null` while the quantity is valid, otherwise why not: whole, non-zero, and positive unless it is a signed adjustment. */
export function stockProblem(type: StockMovement, raw: string): "invalid" | "zero" | "negative" | "tooLarge" | null {
  const text = raw.trim();
  if (!/^-?\d+$/u.test(text)) return "invalid";
  const value = Number(text);
  if (value === 0) return "zero";
  if (Math.abs(value) > STOCK_MAX) return "tooLarge";
  if (type !== "adjustment" && value < 0) return "negative";
  return null;
}

/** Shelf quantity after the movement, or null when the input is not valid yet. */
export function stockAfter(current: number, type: StockMovement, raw: string): number | null {
  if (stockProblem(type, raw) !== null) return null;
  return current + stockDelta(type, Number(raw.trim()));
}

export function stockBody(type: StockMovement, raw: string, note: string): { movement_type: StockMovement; quantity: number; note: string } {
  return { movement_type: type, quantity: Number(raw.trim()), note: note.trim().slice(0, STOCK_NOTE_MAX) };
}

export type StockLevel = "out" | "low" | "ok";

export function stockLevel(stock: number, reorderLevel: number): StockLevel {
  if (stock <= 0) return "out";
  return reorderLevel > 0 && stock <= reorderLevel ? "low" : "ok";
}

// ---- reasons (cancel an order, hide a review) ---------------------------------------------------------------------------

export const REASON_MAX = 255;
export const NOTE_MAX = 500;

export function reasonProblem(reason: string): "required" | "tooLong" | null {
  const text = reason.trim();
  if (!text) return "required";
  return text.length > REASON_MAX ? "tooLong" : null;
}

export function statusBody(status: StoreOrderStatus, reason = "", note = ""): { status: StoreOrderStatus; reason: string; note: string } {
  return { status, reason: status === "cancelled" ? reason.trim() : "", note: note.trim().slice(0, NOTE_MAX) };
}

// ---- list filters -------------------------------------------------------------------------------------------------------

export const ORDER_TAB_ALL = "all";

export function resolveOrderStatus(value: string | null | undefined): StoreOrderStatus | typeof ORDER_TAB_ALL {
  return isOrderStatus(value) ? value : ORDER_TAB_ALL;
}

export function orderQuery(input: { status: string; q: string; from: string; to: string; page: number; pageSize: number }): URLSearchParams {
  const params = new URLSearchParams({ page: String(input.page), page_size: String(input.pageSize) });
  if (isOrderStatus(input.status)) params.set("status", input.status);
  const term = input.q.trim().slice(0, 60);
  if (term) params.set("q", term);
  if (input.from && input.to && input.from > input.to) return params; // an inverted range can never match: not sent
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  return params;
}

export type HiddenFilter = "all" | "visible" | "hidden";

export function resolveHiddenFilter(value: string | null | undefined): HiddenFilter {
  return value === "visible" || value === "hidden" ? value : "all";
}

export function reviewQuery(input: { hidden: HiddenFilter; rating: string; product: string; page: number; pageSize: number }): URLSearchParams {
  const params = new URLSearchParams({ page: String(input.page), page_size: String(input.pageSize) });
  if (input.hidden === "hidden") params.set("is_hidden", "true");
  if (input.hidden === "visible") params.set("is_hidden", "false");
  if (/^[1-5]$/u.test(input.rating)) params.set("rating", input.rating);
  if (/^\d+$/u.test(input.product)) params.set("product", input.product);
  return params;
}

// ---- screen map ---------------------------------------------------------------------------------------------------------

export const STORE_TABS = ["overview", "orders", "products", "reviews"] as const;
export type StoreTab = (typeof STORE_TABS)[number];

export function storeTabHref(locale: string, tab: StoreTab, params?: Record<string, string | number>): string {
  const base = tab === "overview" ? `/${locale}/dashboard/store` : `/${locale}/dashboard/store/${tab}`;
  const query = params ? new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString() : "";
  return query ? `${base}?${query}` : base;
}

/** The order id of `?highlight=<id>` (the inbox notification link) or `?order=<id>`; null for anything that is not a number. */
export function openOrderId(params: { get(name: string): string | null }): number | null {
  for (const name of ["order", "highlight"]) {
    const value = params.get(name);
    if (value && /^\d{1,12}$/u.test(value)) return Number(value);
  }
  return null;
}

export interface LowStockEntry { variant: number; product: number | string; label: string; available: number; reorder_level: number }

export interface StoreSummary {
  orders_by_status: Record<string, number>;
  orders_today: number;
  products_active: number;
  reviews_hidden: number;
  low_stock: LowStockEntry[];
}

/** Orders that need the desk now (waiting + being prepared + ready), summed from the per-status counts. */
export function openOrdersCount(summary: Pick<StoreSummary, "orders_by_status"> | undefined): number {
  if (!summary) return 0;
  return ORDER_STATUSES.filter(isOpenStatus).reduce((sum, status) => sum + (summary.orders_by_status[status] ?? 0), 0);
}
