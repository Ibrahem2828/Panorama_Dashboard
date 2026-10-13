/** Policy-version helpers (terms of use and privacy policy share one model). */

export interface PolicyVersionLike {
  is_active?: unknown;
  published_at?: unknown;
  [key: string]: unknown;
}

/**
 * The version in force: the newest `published_at` among active versions, which is how the backend picks what the
 * mobile apps are shown (`order_by("-published_at").first()` over `is_active=True`).
 */
export function currentVersion<T extends PolicyVersionLike>(versions: readonly T[]): T | null {
  const time = (item: T) => (typeof item.published_at === "string" ? Date.parse(item.published_at) : 0) || 0;
  const active = versions.filter((item) => item.is_active === true);
  if (!active.length) return null;
  return active.reduce((best, item) => (time(item) > time(best) ? item : best));
}

/** Only http(s) links are rendered as anchors (a stored value is staff-entered, never trusted as a script URL). */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
