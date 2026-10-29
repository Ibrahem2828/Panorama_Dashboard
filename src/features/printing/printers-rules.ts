/** Rules of the printer registry screen (pure functions, no React). Types follow the dashboard printers API contract. */

export const PRINTER_PATHS = {
  list: "/api/v1/dashboard/printing/printers/",
  one: (id: number) => `/api/v1/dashboard/printing/printers/${id}/`,
} as const;

export const PRINTER_NAME_MAX = 100;
export const PRINTER_STATION_MAX = 100;
export const PRINTER_NOTES_MAX = 500;
/** The printers list is refreshed this often while the tab is visible. */
export const PRINTER_REFRESH_MS = 15_000;

export interface PrinterJobCounts { queued: number; printing: number; failed_24h: number }

export interface PrinterRecord {
  id: number;
  name: string;
  station: string;
  is_active: boolean;
  is_default: boolean;
  notes: string;
  last_seen_at: string | null;
  /** What the agent last reported: idle, busy or error ("" when unknown), with free-text detail. */
  last_status: string;
  last_detail: string;
  online: boolean;
  jobs: PrinterJobCounts;
}

export interface PrinterForm { name: string; station: string; notes: string; isActive: boolean; isDefault: boolean }

export const EMPTY_PRINTER_FORM: PrinterForm = { name: "", station: "", notes: "", isActive: true, isDefault: false };

export function formFromPrinter(printer: PrinterRecord): PrinterForm {
  return { name: printer.name, station: printer.station ?? "", notes: printer.notes ?? "", isActive: printer.is_active, isDefault: printer.is_default };
}

export interface PrinterFormProblems { name?: "required" | "tooLong"; station?: "tooLong"; notes?: "tooLong" }

export function printerFormProblems(form: PrinterForm): PrinterFormProblems {
  const problems: PrinterFormProblems = {};
  const name = form.name.trim();
  if (!name) problems.name = "required";
  else if (name.length > PRINTER_NAME_MAX) problems.name = "tooLong";
  if (form.station.trim().length > PRINTER_STATION_MAX) problems.station = "tooLong";
  if (form.notes.trim().length > PRINTER_NOTES_MAX) problems.notes = "tooLong";
  return problems;
}

/** The request body of a create or update (an inactive printer cannot stay the default one). */
export function printerBody(form: PrinterForm): Record<string, unknown> {
  return { name: form.name.trim(), station: form.station.trim(), notes: form.notes.trim(), is_active: form.isActive, is_default: form.isActive && form.isDefault };
}

/** Coerces one list entry; entries without a usable id are dropped by the caller. */
export function parsePrinter(raw: unknown): PrinterRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as Record<string, unknown>;
  const id = Number(data.id);
  if (!Number.isInteger(id) || id < 1) return null;
  const jobs = (typeof data.jobs === "object" && data.jobs !== null ? data.jobs : {}) as Record<string, unknown>;
  const count = (value: unknown) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Math.floor(Number(value)) : 0);
  return {
    id,
    name: typeof data.name === "string" ? data.name : "",
    station: typeof data.station === "string" ? data.station : "",
    is_active: data.is_active !== false,
    is_default: data.is_default === true,
    notes: typeof data.notes === "string" ? data.notes : "",
    last_seen_at: typeof data.last_seen_at === "string" ? data.last_seen_at : null,
    last_status: typeof data.last_status === "string" ? data.last_status : "",
    last_detail: typeof data.last_detail === "string" ? data.last_detail : "",
    online: data.online === true,
    jobs: { queued: count(jobs.queued), printing: count(jobs.printing), failed_24h: count(jobs.failed_24h) },
  };
}

/** A delete of a printer that has jobs only deactivates it; the server says so with the code PRINTER_DEACTIVATED. */
export function wasDeactivated(payload: unknown): boolean {
  return typeof payload === "object" && payload !== null && (payload as { code?: unknown }).code === "PRINTER_DEACTIVATED";
}

export type RelativeUnit = "second" | "minute" | "hour" | "day";

/** "5 minutes ago" as a value and a unit, so the caller formats it with Intl in the right locale; null when never seen. */
export function relativeAge(value: string | null | undefined, now: number = Date.now()): { value: number; unit: RelativeUnit } | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  const seconds = Math.max(0, Math.round((now - time) / 1000));
  if (seconds < 60) return { value: -seconds, unit: "second" };
  if (seconds < 3600) return { value: -Math.floor(seconds / 60), unit: "minute" };
  if (seconds < 86_400) return { value: -Math.floor(seconds / 3600), unit: "hour" };
  return { value: -Math.floor(seconds / 86_400), unit: "day" };
}

export function formatRelativeAge(value: string | null | undefined, locale: string, now: number = Date.now()): string | null {
  const age = relativeAge(value, now);
  if (!age) return null;
  return new Intl.RelativeTimeFormat(locale === "ar" ? "ar" : "en", { numeric: "auto" }).format(age.value, age.unit);
}
