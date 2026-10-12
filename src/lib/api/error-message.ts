import type { MessageKey } from "@/i18n/messages";
import { idempotencyConflict } from "@/lib/api/errors";

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

/** User-facing text for a failed request: friendly copy for idempotency conflicts, otherwise the API's own message. */
export function apiErrorText(error: unknown, t: Translate): string {
  const conflict = idempotencyConflict(error);
  if (conflict === "reused") return t("idempotency.reused");
  if (conflict === "in-progress") return t("idempotency.inProgress");
  return error instanceof Error && error.message ? error.message : t("common.unknownError");
}
