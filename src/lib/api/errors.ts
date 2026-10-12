export interface AppApiErrorShape {
  status?: number;
  code?: string;
  message?: string;
  details?: unknown;
  errors?: Record<string, unknown>;
  requestId?: string;
  request_id?: string;
  id_request?: string;
  retryAfter?: number;
}

/** Safe, allowlisted maintenance details the BFF passes through for a MAINTENANCE_MODE response. */
export interface MaintenanceInfo {
  titleAr?: string;
  titleEn?: string;
  messageAr?: string;
  messageEn?: string;
  /** ISO timestamp, when the backend knows it. */
  estimatedEndAt?: string;
  retryAfterSeconds?: number;
}

const MAX_TEXT = 500;

function cleanText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, MAX_TEXT) : undefined;
}

function cleanDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

/** Reads the (flat or `details`-nested) lifecycle payload; every field is optional and length-capped. */
export function parseMaintenanceInfo(payload: unknown, retryAfterSeconds?: number): MaintenanceInfo {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const nested = root.details && typeof root.details === "object" ? (root.details as Record<string, unknown>) : {};
  const pick = (key: string) => nested[key] ?? root[key];
  return {
    titleAr: cleanText(pick("title_ar")),
    titleEn: cleanText(pick("title_en")),
    messageAr: cleanText(pick("message_ar")),
    messageEn: cleanText(pick("message_en")) ?? cleanText(root.message),
    estimatedEndAt: cleanDate(pick("estimated_end_at")),
    retryAfterSeconds,
  };
}

export class AppApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly errors?: Record<string, unknown>;
  readonly requestId?: string;
  readonly request_id?: string;
  readonly retryAfter?: number;
  /** Present on MAINTENANCE_MODE / APP_UPDATE_REQUIRED errors only. */
  maintenance?: MaintenanceInfo;

  constructor(shape: AppApiErrorShape | string) {
    const normalized = typeof shape === "string" ? { message: shape } : shape;
    super(normalized.message ?? "Unexpected API error");
    this.name = "AppApiError";
    this.status = normalized.status ?? 500;
    this.code = normalized.code ?? "UNEXPECTED_ERROR";
    this.details = normalized.details;
    this.errors = normalized.errors;
    this.requestId = normalized.requestId ?? normalized.request_id ?? normalized.id_request;
    this.request_id = this.requestId;
    this.retryAfter = normalized.retryAfter;
  }
}

export function normalizeApiError(error: unknown): AppApiError {
  if (error instanceof AppApiError) return error;
  if (error && typeof error === "object") {
    const raw = error as Record<string, unknown>;
    const errors = raw.errors;
    return new AppApiError({
      status: typeof raw.status === "number" ? raw.status : undefined,
      code: typeof raw.code === "string" ? raw.code : undefined,
      message: typeof raw.message === "string" ? raw.message : undefined,
      details: raw.details,
      errors: errors && typeof errors === "object" ? errors as Record<string, unknown> : undefined,
      requestId: typeof raw.requestId === "string" ? raw.requestId : undefined,
      request_id: typeof raw.request_id === "string" ? raw.request_id : undefined,
      id_request: typeof raw.id_request === "string" ? raw.id_request : undefined,
      retryAfter: typeof raw.retryAfter === "number" && raw.retryAfter > 0 ? raw.retryAfter : undefined,
    });
  }
  return new AppApiError(error instanceof Error ? error.message : "Unexpected API error");
}

export const toAppApiError = normalizeApiError;

export function isMaintenanceError(error: unknown): boolean {
  return error instanceof AppApiError && error.status === 503 && error.code === "MAINTENANCE_MODE";
}

export function isUpdateRequiredError(error: unknown): boolean {
  return error instanceof AppApiError && error.status === 426 && error.code === "APP_UPDATE_REQUIRED";
}

/** Idempotency conflicts the backend reports with 409; they get dedicated, friendlier messages than a generic conflict. */
export type IdempotencyConflict = "reused" | "in-progress";

export function idempotencyConflict(error: unknown): IdempotencyConflict | null {
  if (!(error instanceof AppApiError) || error.status !== 409) return null;
  if (error.code === "IDEMPOTENCY_KEY_REUSED") return "reused";
  if (error.code === "IDEMPOTENCY_IN_PROGRESS") return "in-progress";
  return null;
}
