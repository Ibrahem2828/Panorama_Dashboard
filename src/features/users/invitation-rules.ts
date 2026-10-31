import type { MessageKey } from "@/i18n/messages";
import { apiErrorText } from "@/lib/api/error-message";
import { AppApiError } from "@/lib/api/errors";

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

export type InvitationLifecycle = "pending" | "accepted" | "expired" | "revoked" | "none";

export interface ActivityInvitation {
  state: InvitationLifecycle;
  mode?: string | null;
  purpose?: "invite" | "reset" | null;
  accepted_at?: string | null;
  last_sent_at?: string | null;
  password_set?: boolean;
  delivery?: { status: "ok" | "failed" | null; sent_at?: string | null; error?: string | null };
}

/** `data` of `POST dashboard/users/<id>/resend-invitation/`. */
export interface ResendResult { purpose?: "invite" | "reset"; email_sent?: boolean }

/** An account that already accepted its invitation gets a password-reset link instead of a new invitation. */
export function isResetAction(invitation: ActivityInvitation | undefined): boolean {
  return invitation?.state === "accepted";
}

/** Fallback Arabic names for the invitation audit actions, used when the backend sends no `action_label`. */
export const STAFF_ACTION_KEYS: Record<string, MessageKey> = {
  user_invited: "staff.action.user_invited",
  user_invitation_accepted: "staff.action.user_invitation_accepted",
  user_invitation_revoked: "staff.action.user_invitation_revoked",
  user_sessions_ended: "staff.action.user_sessions_ended",
};

export function actionLabel(row: { action: string; action_label?: string | null }, t: Translate, enumLabel: (value: unknown) => string): string {
  if (row.action_label && row.action_label.trim()) return row.action_label;
  const key = STAFF_ACTION_KEYS[row.action];
  return key ? t(key) : enumLabel(row.action);
}

const CODE_KEYS: Record<string, MessageKey> = {
  USER_INACTIVE: "staff.error.USER_INACTIVE",
  PERMISSION_DENIED: "staff.error.PERMISSION_DENIED",
  INVITATION_ACCEPTED_ALREADY: "staff.error.INVITATION_ACCEPTED_ALREADY",
  INVITATION_EXPIRED: "staff.error.INVITATION_EXPIRED",
  INVITATION_REVOKED: "staff.error.INVITATION_REVOKED",
  INVITATION_INVALID: "staff.error.INVITATION_INVALID",
};
const ARABIC = /[؀-ۿ]/u;

/** Why an onboarding action failed: the server's Arabic message, else a mapped code, else the shared status text. */
export function staffActionErrorText(error: unknown, t: Translate): string {
  if (error instanceof AppApiError) {
    if (error.message && ARABIC.test(error.message)) return error.message;
    const key = Object.hasOwn(CODE_KEYS, error.code) ? CODE_KEYS[error.code] : undefined;
    if (key) return t(key);
    return apiErrorText(error, t);
  }
  return t("staff.actionFailed");
}
