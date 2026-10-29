/** Pure helpers of the orders tab filters (the date range of `created_after` / `created_before`). */

export const ORDER_DATE_PARAMS = { from: "created_after", to: "created_before" } as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;

/** A real calendar day written YYYY-MM-DD, or "" for anything else (a hand-edited URL must not reach the server). */
export function cleanDate(value: string | null | undefined): string {
  const match = ISO_DATE.exec((value ?? "").trim());
  if (!match) return "";
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

/** "order" when the end day is before the start day: such a range can never match, so it is not sent. */
export function dateRangeProblem(from: string, to: string): "order" | null {
  return from && to && from > to ? "order" : null;
}

/** The date parameters to send: both days are inclusive; an inverted range sends none. */
export function dateRangeParams(from: string, to: string): Record<string, string> {
  if (dateRangeProblem(from, to)) return {};
  return { ...(from ? { [ORDER_DATE_PARAMS.from]: from } : {}), ...(to ? { [ORDER_DATE_PARAMS.to]: to } : {}) };
}
