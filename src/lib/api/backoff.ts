import { AppApiError, isMaintenanceError, isUpdateRequiredError } from "@/lib/api/errors";

export interface BackoffOptions {
  baseMs?: number;
  maxMs?: number;
  /** 0..1; injectable for tests. */
  random?: () => number;
}

/**
 * Capped exponential backoff with "equal jitter": half of the window is fixed, half is random, so retries from many
 * clients spread out without ever collapsing to zero. attempt is 0-based.
 */
export function backoffDelay(attempt: number, { baseMs = 1000, maxMs = 30_000, random = Math.random }: BackoffOptions = {}): number {
  const exponent = Math.min(Math.max(0, Math.floor(attempt)), 30);
  const ceiling = Math.min(maxMs, baseMs * 2 ** exponent);
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}

const MAX_RETRY_AFTER_MS = 120_000;

/** React Query `retryDelay`: honours a server `Retry-After`, else capped exponential backoff with jitter. */
export function retryDelay(attempt: number, error: unknown, options: BackoffOptions = {}): number {
  if (error instanceof AppApiError && error.retryAfter && error.retryAfter > 0) {
    return Math.min(MAX_RETRY_AFTER_MS, Math.ceil(error.retryAfter * 1000));
  }
  return backoffDelay(attempt, { baseMs: 1000, maxMs: 30_000, ...options });
}

/** React Query `retry`: never retry client errors, lifecycle states or rate limits (the user/UI handles those). */
export function shouldRetryQuery(count: number, error: unknown): boolean {
  if (error instanceof AppApiError) {
    if (isMaintenanceError(error) || isUpdateRequiredError(error) || error.status === 429) return false;
    if (error.status >= 400 && error.status < 500 && error.status !== 408) return false;
  }
  return count < 2;
}
