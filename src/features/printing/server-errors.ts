import { AppApiError } from "@/lib/api/errors";

/** First human-readable sentence inside a DRF-style error value (a string, a list of strings or a nested object). */
export function firstMessage(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstMessage(entry);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) {
      const found = firstMessage(entry);
      if (found) return found;
    }
  }
  return null;
}

function errorMap(error: unknown): Record<string, unknown> {
  if (!(error instanceof AppApiError)) return {};
  for (const candidate of [error.errors, error.details]) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) return candidate as Record<string, unknown>;
  }
  return {};
}

/** The server's message for one top-level field of a 400 response (for example `name`), or null. */
export function fieldError(error: unknown, field: string): string | null {
  return firstMessage(errorMap(error)[field]);
}

/**
 * Per-item field errors of an order request: `errors.items` is a list (or an object keyed by position) whose entries map a field
 * such as `page_range` to its messages. Returns one map per item index that has a message.
 */
export function itemFieldErrors(error: unknown): Record<number, Record<string, string>> {
  const raw = errorMap(error).items;
  const result: Record<number, Record<string, string>> = {};
  const entries: [number, unknown][] = Array.isArray(raw)
    ? raw.map((entry, index) => [index, entry])
    : raw && typeof raw === "object" ? Object.entries(raw).map(([key, entry]) => [Number(key), entry]) : [];
  for (const [index, entry] of entries) {
    if (!Number.isInteger(index) || !entry || typeof entry !== "object") continue;
    const fields: Record<string, string> = {};
    for (const [field, value] of Object.entries(entry as Record<string, unknown>)) {
      const message = firstMessage(value);
      if (message) fields[field] = message;
    }
    if (Object.keys(fields).length) result[index] = fields;
  }
  return result;
}

const ARABIC_SCRIPT = /[؀-ۿ]/u;

/** A server sentence is shown as is in English; in Arabic only when it is itself Arabic, otherwise the localized fallback. */
export function displayServerMessage(message: string | null, locale: string, fallback: string): string | null {
  if (!message) return null;
  return locale !== "ar" || ARABIC_SCRIPT.test(message) ? message : fallback;
}
