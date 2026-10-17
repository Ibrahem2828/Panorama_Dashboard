import type { MessageKey } from "@/i18n/messages";
import { AppApiError, idempotencyConflict } from "@/lib/api/errors";

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

const GENERIC_BACKEND_TEXT = new Set(["Permission denied", "Request failed", "An error occurred", "Conflict"]);
const ARABIC_SCRIPT = /[\u0600-\u06FF]/u;

/** Catalog key of the localized headline for an HTTP status. */
export const STATUS_MESSAGE_KEYS: Partial<Record<number, MessageKey>> = {
  400: "errors.400",
  401: "errors.401",
  403: "errors.403",
  404: "errors.404",
  409: "errors.409",
  413: "errors.413",
  426: "errors.426",
  429: "errors.429",
  500: "errors.500",
  502: "errors.502",
  503: "errors.503",
  504: "errors.504",
};

/** True for a backend-supplied sentence that is already Arabic (safe to show); English transport text is never shown. */
function arabicBackendText(message: string | undefined): string | null {
  return message && ARABIC_SCRIPT.test(message) && !GENERIC_BACKEND_TEXT.has(message) ? message : null;
}

/** The localized sentence for an API error (a backend sentence is shown only when it is Arabic). */
export function localizedApiMessage(error: AppApiError, t: Translate): string {
  if (error.code === "BACKEND_NETWORK_UNAVAILABLE") return t("errors.network");
  return arabicBackendText(error.message) ?? t(STATUS_MESSAGE_KEYS[error.status] ?? "errors.500");
}

/**
 * User-facing text for a failed request, always Arabic/localized: friendly copy for idempotency conflicts, a localized
 * headline per status (403/409 followed by the backend reason only when that reason is Arabic), and a generic message
 * for anything else. English transport/BFF messages are kept for logs and never shown.
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
    const reason = arabicBackendText(error.message);
    return reason ? `${headline} ${reason}` : headline;
  }
  if (error instanceof AppApiError) return localizedApiMessage(error, t);
  if (error instanceof DOMException && error.name === "AbortError") return t("errors.uploadCancelled");
  return error instanceof Error ? arabicBackendText(error.message) ?? t("common.unknownError") : t("common.unknownError");
}
