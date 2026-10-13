/**
 * Conversions between the `<input type="datetime-local">` format (`YYYY-MM-DDTHH:mm`, wall-clock time in the
 * viewer's zone) and the ISO-8601 instants the backend stores and returns.
 */

const LOCAL_INPUT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/u;

function pad(value: number, width = 2) {
  return String(value).padStart(width, "0");
}

/** ISO instant (or anything `Date` can parse) to the value a datetime-local input expects; "" when empty or invalid. */
export function isoToLocalInput(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** datetime-local input value to a UTC ISO string; null when empty or not a valid local date-time. */
export function localInputToIso(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!LOCAL_INPUT.test(trimmed)) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
