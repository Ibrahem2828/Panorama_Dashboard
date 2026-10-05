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

export class AppApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly errors?: Record<string, unknown>;
  readonly requestId?: string;
  readonly request_id?: string;
  readonly retryAfter?: number;

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
    });
  }
  return new AppApiError(error instanceof Error ? error.message : "Unexpected API error");
}

export const toAppApiError = normalizeApiError;
