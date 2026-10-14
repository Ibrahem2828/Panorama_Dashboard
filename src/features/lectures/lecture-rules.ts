/**
 * Pure rules of the lectures section: processing statuses, polling, row actions, URL filters and error mapping.
 * Status names are the backend's (`apps/lectures/models.py` LectureProcessingStatus); nothing here touches the network.
 */
import { AppApiError, idempotencyConflict } from "@/lib/api/errors";

export const LECTURE_STATUSES = ["uploaded", "queued", "scanning", "converting", "extracting", "rendering", "ready", "failed", "quarantined"] as const;
export type LectureStatus = (typeof LECTURE_STATUSES)[number];

/** Not final: a worker is (or should be) moving the lecture forward. */
export const IN_FLIGHT_STATUSES: readonly LectureStatus[] = ["uploaded", "queued", "scanning", "converting", "extracting", "rendering"];

/** Same horizon as the backend (`apps/lectures/services.py` STALLED_AFTER): an in-flight lecture older than this may be retried. */
export const STALLED_AFTER_MS = 30 * 60 * 1000;

export interface LectureRow {
  id: number;
  subject: number;
  subject_name?: string;
  title: string;
  description?: string;
  original_filename?: string;
  original_mime_type?: string;
  original_size?: number;
  original_sha256?: string;
  status: string;
  page_count?: number;
  failure_code?: string;
  failure_message?: string;
  is_published: boolean;
  published_at?: string | null;
  uploaded_by?: number;
  created_at?: string;
  updated_at?: string;
}

export function isLectureStatus(value: unknown): value is LectureStatus {
  return typeof value === "string" && (LECTURE_STATUSES as readonly string[]).includes(value);
}

export function isInFlight(status: unknown): boolean {
  return typeof status === "string" && (IN_FLIGHT_STATUSES as readonly string[]).includes(status);
}

export type StatusTone = "success" | "danger" | "progress" | "neutral";

export function statusTone(status: unknown): StatusTone {
  if (status === "ready") return "success";
  if (status === "failed" || status === "quarantined") return "danger";
  if (isInFlight(status)) return "progress";
  return "neutral";
}

/**
 * Badge colours as solid light/dark pairs (800/900 text on 100 backgrounds, 100/200 text on 900/950 backgrounds), all
 * above 7:1, so contrast never depends on a translucent layer. The badge also always carries a text label and an icon.
 */
export const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  success: "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100",
  danger: "border-red-300 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100",
  progress: "border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100",
  neutral: "border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
};

export const POLL_BASE_MS = 10_000;
export const POLL_MAX_MS = 60_000;

/**
 * Auto-refresh rule: poll only while at least one visible lecture is in an in-flight status and the tab is visible.
 * After consecutive failed refreshes the delay doubles (10 s, 20 s, 40 s, capped at 60 s). `false` stops polling.
 */
export function pollInterval({ rows, hidden, failures = 0 }: { rows: readonly { status?: unknown }[] | undefined; hidden: boolean; failures?: number }): number | false {
  if (hidden) return false;
  if (!rows?.some((row) => isInFlight(row.status))) return false;
  return Math.min(POLL_MAX_MS, POLL_BASE_MS * 2 ** Math.min(Math.max(0, Math.floor(failures)), 10));
}

export function isStalled(row: Pick<LectureRow, "status" | "updated_at">, now: number): boolean {
  if (!isInFlight(row.status) || !row.updated_at) return false;
  const updated = Date.parse(row.updated_at);
  return Number.isFinite(updated) && now - updated > STALLED_AFTER_MS;
}

/** Mirrors the backend `lecture_is_retryable`: failed, or in flight without progress for 30 minutes. Quarantined and ready never. */
export function isRetryable(row: Pick<LectureRow, "status" | "updated_at">, now: number): boolean {
  return row.status === "failed" || isStalled(row, now);
}

export interface LectureActionSet { view: true; edit: boolean; delete: boolean; publish: boolean; unpublish: boolean; retry: boolean }

/** Which row actions are offered. Everything beyond viewing needs `lectures.manage`; publishing needs a ready lecture. */
export function lectureActions(row: LectureRow, { canManage, now }: { canManage: boolean; now: number }): LectureActionSet {
  return {
    view: true,
    edit: canManage,
    delete: canManage,
    publish: canManage && row.status === "ready" && !row.is_published,
    // A lecture that is still published must always be withdrawable, whatever its processing status is.
    unpublish: canManage && row.is_published,
    retry: canManage && isRetryable(row, now),
  };
}

export const LECTURE_PAGE_SIZES = [10, 25, 50, 100] as const;

export interface LectureListParams {
  page: number;
  pageSize: number;
  subject: string;
  status: string;
  isPublished: string;
}

type Params = { get(name: string): string | null };

/** Reads the URL: unknown or malformed values are dropped so a hand-edited link cannot send arbitrary filters. */
export function parseLectureParams(params: Params): LectureListParams {
  const page = Number(params.get("page"));
  const size = Number(params.get("page_size"));
  const subject = params.get("subject") ?? "";
  const status = params.get("status") ?? "";
  const published = params.get("is_published") ?? "";
  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    pageSize: (LECTURE_PAGE_SIZES as readonly number[]).includes(size) ? size : 25,
    subject: /^\d{1,12}$/u.test(subject) ? subject : "",
    status: isLectureStatus(status) ? status : "",
    isPublished: published === "true" || published === "false" ? published : "",
  };
}

/** Query parameters of the dashboard list endpoint (`filterset_fields = subject, status, is_published`). */
export function lectureQueryFilters(params: LectureListParams): Record<string, string> {
  const filters: Record<string, string> = {};
  if (params.subject) filters.subject = params.subject;
  if (params.status) filters.status = params.status;
  if (params.isPublished) filters.is_published = params.isPublished;
  return filters;
}

export type LectureErrorKind =
  | "duplicate" | "notRetryable" | "tooLarge" | "rateLimited" | "maintenance" | "unavailable"
  | "forbidden" | "notFound" | "fields" | "other";

export interface LectureError {
  kind: LectureErrorKind;
  /** Server text per request field (400 validation), for inline display. */
  fields: Record<string, string>;
  retryAfter?: number;
}

const DUPLICATE_TEXT = /already (registered|exists)/iu;

function fieldTexts(errors: Record<string, unknown> | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  const text = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(text).filter(Boolean).join(" ");
    if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).map(text).filter(Boolean).join(" ");
    return "";
  };
  for (const [name, value] of Object.entries(errors ?? {})) {
    const message = text(value);
    if (message) result[name] = message;
  }
  return result;
}

/**
 * Classifies a failed lecture request. The backend answers a repeated (subject, sha256) with a 400 on `original_file`
 * ("already registered") and a lost race on the unique constraint with 409, so both mean "duplicate" for an upload; a 409
 * `lecture_not_retryable` means the retry endpoint refused. Idempotency conflicts are left to the generic message.
 */
export function classifyLectureError(error: unknown, context: "upload" | "retry" | "action" = "action"): LectureError {
  if (!(error instanceof AppApiError)) return { kind: "other", fields: {} };
  const fields = fieldTexts(error.errors);
  if (error.status === 400) {
    if (fields.original_file && DUPLICATE_TEXT.test(fields.original_file)) return { kind: "duplicate", fields };
    return { kind: Object.keys(fields).length ? "fields" : "other", fields };
  }
  if (error.status === 409 && !idempotencyConflict(error)) {
    if (context === "retry" || error.code.toLowerCase() === "lecture_not_retryable") return { kind: "notRetryable", fields };
    if (context === "upload") return { kind: "duplicate", fields };
    return { kind: "other", fields };
  }
  if (error.status === 413) return { kind: "tooLarge", fields };
  if (error.status === 429) return { kind: "rateLimited", fields, retryAfter: error.retryAfter };
  if (error.status === 503) return { kind: error.code === "MAINTENANCE_MODE" ? "maintenance" : "unavailable", fields };
  if (error.status === 403) return { kind: "forbidden", fields };
  if (error.status === 404) return { kind: "notFound", fields };
  return { kind: "other", fields };
}
