import type { MessageKey } from "@/i18n/messages";
import { AppApiError, idempotencyConflict } from "@/lib/api/errors";

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

const GENERIC_BACKEND_TEXT = new Set(["Permission denied", "Request failed", "An error occurred", "Conflict"]);

/**
 * User-facing text for a failed request: friendly copy for idempotency conflicts, a localized headline for 403/409
 * followed by the backend's specific reason (for example "You cannot manage an account with an equal or higher role"),
 * otherwise the API's own message.
 */
export function apiErrorText(error: unknown, t: Translate): string {
  const conflict = idempotencyConflict(error);
  if (conflict === "reused") return t("idempotency.reused");
  if (conflict === "in-progress") return t("idempotency.inProgress");
  if (error instanceof AppApiError && error.status === 429) {
    // The login lockout and throttles send Retry-After (seconds); without it fall back to the generic limit text.
    return error.retryAfter && error.retryAfter > 0
      ? t("errors.rateLimitedWait", { seconds: Math.ceil(error.retryAfter) })
      : t("errors.429");
  }
  if (error instanceof AppApiError && error.status === 404) return t("errors.404");
  if (error instanceof AppApiError && (error.status === 403 || error.status === 409)) {
    const headline = t(error.status === 403 ? "errors.403" : "errors.409");
    return error.message && !GENERIC_BACKEND_TEXT.has(error.message) ? `${headline} ${error.message}` : headline;
  }
  return error instanceof Error && error.message ? error.message : t("common.unknownError");
}
