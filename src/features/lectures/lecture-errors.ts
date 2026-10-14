import { classifyLectureError } from "@/features/lectures/lecture-rules";
import type { MessageKey } from "@/i18n/messages";
import { apiErrorText } from "@/lib/api/error-message";

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

/** Localized, user-facing text for a failed lecture request (see `classifyLectureError` for how failures are told apart). */
export function lectureErrorText(error: unknown, t: Translate, context: "upload" | "retry" | "action" = "action"): string {
  const { kind } = classifyLectureError(error, context);
  switch (kind) {
    case "duplicate": return t("lectures.error.duplicate");
    case "notRetryable": return t("lectures.error.notRetryable");
    case "tooLarge": return t("lectures.error.tooLarge");
    case "maintenance": return t("lectures.error.maintenance");
    case "unavailable": return t("lectures.error.unavailable");
    case "forbidden": return t("lectures.error.forbidden");
    case "notFound": return t("lectures.error.notFound");
    case "fields": return t("form.fixFields");
    default: return apiErrorText(error, t);
  }
}
