import type { Query, QueryClient } from "@tanstack/react-query";

/** Dashboard screens re-read their data this often (milliseconds). */
export const AUTO_REFRESH_INTERVAL_MS = 30_000;
/** A query that was refreshed less than this long ago is left alone by a tick (it was just fetched by something else). */
const MIN_AGE_MS = 20_000;
const STORAGE_KEY = "panorama.autoRefresh.paused";

/**
 * Queries that must never be re-read behind the user's back. A query can also opt out itself with
 * `meta: { autoRefresh: false }`. Documented in the PR that introduced the global refresh.
 *  - session / capabilities: authentication state; it has its own refresh and a failure would sign the user out.
 *  - term-*: the end-of-term wizard (a multi-step flow whose lists must stay what the operator confirmed).
 *  - protected-preview / chat-attachment: authenticated file viewers (a refetch would revoke or reload the opened file).
 *  - reference-options / filter-lookup / vt-options / assignees / permission-templates / file-visibility-templates:
 *    lookups that feed open selects and forms; they change rarely and are refreshed on use.
 *  - counter-quote / print-options-counter / print-products-counter / printing-order-copy: the walk-in order form
 *    (live pricing the cashier is editing).
 */
export const AUTO_REFRESH_EXCLUDED_KEYS: readonly string[] = [
  "session", "capabilities", "protected-preview", "chat-attachment", "reference-options", "filter-lookup", "vt-options", "assignees",
  "permission-templates", "file-visibility-templates", "counter-quote", "print-options-counter", "print-products-counter", "printing-order-copy",
];
const EXCLUDED_KEY_PREFIXES: readonly string[] = ["term-"];
/** Background plumbing that is not "screen data": it neither counts as a refresh nor is refreshed by the scheduler. */
const INDICATOR_IGNORED_KEYS: readonly string[] = ["inbox-summary", "inbox-list", "quick-access", "global-backend-readiness", "backend-health-ready"];

type AnyQuery = Pick<Query, "queryKey" | "meta">;

function head(query: AnyQuery): string {
  const first = query.queryKey[0];
  return typeof first === "string" ? first : "";
}

/** False for queries that opted out (meta) or sit on the exclusion list. */
export function isAutoRefreshable(query: AnyQuery): boolean {
  if (query.meta?.autoRefresh === false) return false;
  const key = head(query);
  return !AUTO_REFRESH_EXCLUDED_KEYS.includes(key) && !EXCLUDED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** Whether a finished fetch of this query counts as "the screen was updated" for the topbar indicator. */
export function countsForIndicator(query: AnyQuery): boolean {
  return isAutoRefreshable(query) && !INDICATOR_IGNORED_KEYS.includes(head(query));
}

/** True while a modal dialog / sheet is open: forms inside must not have data re-read under them. */
export function isDialogOpen(doc: Document | undefined = typeof document === "undefined" ? undefined : document): boolean {
  return Boolean(doc?.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'));
}

// ---- pause state (remembered in localStorage; every access is guarded) ----
let paused = false;
let loaded = false;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((listener) => listener()); }

export function readPaused(): boolean {
  if (!loaded) {
    loaded = true;
    try { paused = window.localStorage.getItem(STORAGE_KEY) === "1"; } catch { paused = false; }
  }
  return paused;
}

export function setPaused(next: boolean) {
  readPaused();
  paused = next;
  try { window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* storage unavailable: keep it for this tab only */ }
  emit();
}

/** Forgets the in-memory copy (tests). */
export function resetPausedCache() { loaded = false; paused = false; }

// ---- last refresh time ----
let lastRefreshAt: number | null = null;
export function readLastRefreshAt(): number | null { return lastRefreshAt; }
export function markRefreshed(at: number = Date.now()) { lastRefreshAt = at; emit(); }
export function resetLastRefresh() { lastRefreshAt = null; }

export function subscribeAutoRefresh(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Can this query be re-read now by the scheduler? (Own faster polls are respected, not doubled.) */
function due(query: Query, now: number): boolean {
  if (!isAutoRefreshable(query) || head(query) === "" || INDICATOR_IGNORED_KEYS.includes(head(query))) return false;
  if (query.state.fetchStatus !== "idle" || query.getObserversCount() === 0 || !query.isActive()) return false;
  if (query.state.data === undefined) return false;
  if (query.observers.some((observer) => observer.options.refetchInterval)) return false;
  return now - query.state.dataUpdatedAt >= MIN_AGE_MS;
}

export interface TickContext { now?: number; hidden?: boolean; dialogOpen?: boolean; force?: boolean }

/**
 * One refresh pass: re-reads every mounted, idle, refreshable query. Skipped entirely when paused, when the tab is
 * hidden, while a dialog is open or while a write is in flight. `force` (the manual button) ignores all of these except
 * the opt-outs, and refetches regardless of age.
 */
export async function refreshTick(client: QueryClient, context: TickContext = {}): Promise<boolean> {
  const now = context.now ?? Date.now();
  if (!context.force) {
    const hidden = context.hidden ?? (typeof document !== "undefined" && document.visibilityState === "hidden");
    if (readPaused() || hidden || (context.dialogOpen ?? isDialogOpen()) || client.isMutating() > 0) return false;
  }
  await client.refetchQueries({
    type: "active",
    predicate: (query) => (context.force
      ? isAutoRefreshable(query) && query.state.fetchStatus === "idle" && !INDICATOR_IGNORED_KEYS.includes(head(query))
      : due(query, now)),
  }, { cancelRefetch: false, throwOnError: false });
  return true;
}
