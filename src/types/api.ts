export interface ApiEnvelope<T> {
  success?: boolean;
  data: T;
  message?: string;
  code?: string;
  id_request?: string;
  request_id?: string;
  errors?: Record<string, unknown>;
}

export interface PaginatedData<T> {
  items: T[];
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}

export interface AppApiErrorShape {
  status?: number;
  code?: string;
  message?: string;
  id_request?: string;
  details?: unknown;
  errors?: Record<string, unknown>;
  requestId?: string;
  request_id?: string;
  retryAfter?: number;
}

export interface ApiResponse<T> extends ApiEnvelope<T> { success: boolean; }
export type ApiSuccessResponse<T> = ApiResponse<T>;
export type ApiErrorResponse = AppApiErrorShape;
export type PaginatedResponse<T> = PaginatedData<T>;
export type FrontendApiError = AppApiErrorShape;
