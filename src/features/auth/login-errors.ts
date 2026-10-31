import type { MessageKey } from "@/i18n/messages";
import { apiErrorText } from "@/lib/api/error-message";
import { AppApiError } from "@/lib/api/errors";

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

const MINUTE_KEYS: Record<string, MessageKey> = {
  one: "auth.minutes.one",
  two: "auth.minutes.two",
  few: "auth.minutes.few",
  many: "auth.minutes.many",
  other: "auth.minutes.other",
};

/** "دقيقتين" / "5 دقائق" / "12 دقيقة" (or "1 minute" / "3 minutes"), rounded up so the user never retries too early. */
export function waitText(retryAfterSeconds: number, locale: string, t: Translate): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  const category = new Intl.PluralRules(locale === "ar" ? "ar" : "en").select(minutes);
  const number = new Intl.NumberFormat(locale === "ar" ? "ar-SY" : "en-US").format(minutes);
  return t(MINUTE_KEYS[category] ?? "auth.minutes.other", { count: number });
}

/**
 * Message for a failed sign-in. The backend answers HTTP 400 (`errors.identifier`) for wrong credentials, a staff
 * account that never set its password, an inactive or unverified account: deliberately one generic outcome so the
 * login can never be used to find out whether an account exists, and so is this text. The BFF forwards only the
 * status, so any 400/401 from the login route means "could not sign in with these details".
 */
export function loginErrorText(error: unknown, t: Translate, locale: string): string {
  if (error instanceof AppApiError) {
    if (error.status === 429) {
      return error.retryAfter && error.retryAfter > 0
        ? t("auth.loginThrottled", { wait: waitText(error.retryAfter, locale, t) })
        : t("auth.loginThrottledGeneric");
    }
    if (error.status === 400 || error.status === 401) return t("auth.invalidCredentials");
  }
  // Network failures, 5xx, maintenance, dashboard-access denial and anything else keep the shared wording.
  return apiErrorText(error, t);
}
