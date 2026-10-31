import type { FilterField, FilterOption, FilterSchema } from "@/components/filters/filter-types";
import type { MessageKey } from "@/i18n/messages";

/** Contract of `GET /api/v1/dashboard/system-activity/*` (backend branch feat/system-activity-log). */
export const ACTIVITY_KINDS = ["request", "login_success", "login_failed", "logout", "denied"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const FAILED_LOGIN_REASONS = ["invalid_credentials", "password_not_set", "inactive_account", "unverified", "locked"] as const;
export type FailedLoginReason = (typeof FAILED_LOGIN_REASONS)[number];

export interface ActivityUser { id: number; full_name: string; email: string; role: string; job_title: string | null }

export interface ActivityRow {
  id: number;
  created_at: string;
  user: ActivityUser | null;
  user_label: string;
  kind: ActivityKind;
  action_label: string;
  method: string;
  route: string;
  status_code: number | null;
  object_type: string | null;
  object_id: string | null;
  ip: string | null;
  user_agent: string | null;
  duration_ms: number | null;
  extra: Record<string, unknown> | null;
}

export interface ActivitySummary {
  total: number;
  errors: number;
  failed_logins: number;
  active_users: number;
  by_kind: Record<ActivityKind, number>;
}

export interface ActivityUserRollup {
  user: ActivityUser;
  last_activity_at: string | null;
  requests_24h: number;
  requests_7d: number;
  failed_logins_24h: number;
  last_action_label: string | null;
  last_ip: string | null;
}

export const REASON_LABEL_KEYS: Record<FailedLoginReason, MessageKey> = {
  invalid_credentials: "sysActivity.reason.invalid_credentials",
  password_not_set: "sysActivity.reason.password_not_set",
  inactive_account: "sysActivity.reason.inactive_account",
  unverified: "sysActivity.reason.unverified",
  locked: "sysActivity.reason.locked",
};

export const KIND_LABEL_KEYS: Record<ActivityKind, MessageKey> = {
  request: "sysActivity.kind.request",
  login_success: "sysActivity.kind.login_success",
  login_failed: "sysActivity.kind.login_failed",
  logout: "sysActivity.kind.logout",
  denied: "sysActivity.kind.denied",
};

export function isFailedLoginReason(value: unknown): value is FailedLoginReason {
  return typeof value === "string" && (FAILED_LOGIN_REASONS as readonly string[]).includes(value);
}

/** Catalog key of a failed-login reason; unknown codes from a newer backend fall back to the generic "failed" text. */
export function reasonLabelKey(reason: unknown): MessageKey {
  return isFailedLoginReason(reason) ? REASON_LABEL_KEYS[reason] : "sysActivity.reason.unknown";
}

/** Tone of the reason badge: locked and wrong credentials are the loud ones. */
export function reasonTone(reason: unknown): "destructive" | "warning" | "outline" {
  if (reason === "locked" || reason === "invalid_credentials") return "destructive";
  if (reason === "password_not_set" || reason === "unverified" || reason === "inactive_account") return "warning";
  return "outline";
}

export type Outcome = "success" | "error";

/** A request is an error from HTTP 400 up; a failed login or a denied request always counts as one. */
export function outcomeOf(row: Pick<ActivityRow, "kind" | "status_code">): Outcome {
  if (row.kind === "login_failed" || row.kind === "denied") return "error";
  return row.status_code !== null && row.status_code >= 400 ? "error" : "success";
}

export function failedReasonOf(row: Pick<ActivityRow, "kind" | "extra">): unknown {
  return row.kind === "login_failed" ? row.extra?.reason : undefined;
}

export const ACTIVITY_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export const ACTIVITY_ROLES = ["it_support", "admin", "print_staff", "support_staff", "content_manager", "student", "normal_user"] as const;

export const ACTIVITY_PARAMS = { user: "user", role: "role", kind: "kind", method: "method", outcome: "outcome", route: "route", after: "created_after", before: "created_before" } as const;

export function activitySchema(fields: readonly FilterField[]): FilterSchema {
  return { fields, searchParam: "search" };
}

export function activityFields(input: {
  t: (key: MessageKey) => string;
  roleLabel: (role: string) => string;
  userOptions: readonly FilterOption[];
  selectedUser?: string;
}): FilterField[] {
  const { t } = input;
  const users = [...input.userOptions];
  if (input.selectedUser && !users.some((option) => option.value === input.selectedUser)) users.unshift({ value: input.selectedUser, label: `#${input.selectedUser}` });
  return [
    { kind: "select", key: ACTIVITY_PARAMS.user, label: t("sysActivity.filter.user"), options: users, placement: "primary" },
    { kind: "select", key: ACTIVITY_PARAMS.kind, label: t("sysActivity.filter.kind"), options: ACTIVITY_KINDS.map((kind) => ({ value: kind, label: t(KIND_LABEL_KEYS[kind]) })), placement: "primary" },
    { kind: "select", key: ACTIVITY_PARAMS.outcome, label: t("sysActivity.filter.outcome"), options: [{ value: "success", label: t("sysActivity.outcome.success") }, { value: "error", label: t("sysActivity.outcome.error") }], placement: "primary" },
    { kind: "select", key: ACTIVITY_PARAMS.role, label: t("sysActivity.filter.role"), options: ACTIVITY_ROLES.map((role) => ({ value: role, label: input.roleLabel(role) })), placement: "advanced" },
    { kind: "select", key: ACTIVITY_PARAMS.method, label: t("sysActivity.filter.method"), options: ACTIVITY_METHODS.map((method) => ({ value: method, label: method })), placement: "advanced" },
    { kind: "text", key: ACTIVITY_PARAMS.route, label: t("sysActivity.filter.route"), placeholder: "/api/v1/…", placement: "advanced" },
    { kind: "date-range", key: "created", label: t("sysActivity.filter.dates"), fromKey: ACTIVITY_PARAMS.after, toKey: ACTIVITY_PARAMS.before, placement: "advanced" },
  ];
}

export function userDisplayName(user: Pick<ActivityUser, "full_name" | "email"> | null, fallback: string): string {
  return user?.full_name || user?.email || fallback;
}
