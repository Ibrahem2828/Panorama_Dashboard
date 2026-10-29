/**
 * Types and pure helpers of the user profile page (`GET /api/v1/dashboard/users/<id>/student-detail/`).
 * The response types live here, next to the feature, until the generated contracts are re-synced.
 */
export const PROFILE_TABS = ["overview", "groups", "enrollments", "files", "orders", "tickets", "verification"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

/** `?tab=` value to a tab; anything unknown falls back to the overview. */
export function parseProfileTab(value: string | null | undefined): ProfileTab {
  return (PROFILE_TABS as readonly string[]).includes(value ?? "") ? (value as ProfileTab) : "overview";
}

/** Query string for a tab, dropping the default so the overview URL stays clean. */
export function profileTabHref(pathname: string, tab: ProfileTab): string {
  return tab === "overview" ? pathname : `${pathname}?tab=${tab}`;
}

export interface NamedRef { id?: number; name?: string }
export type RefValue = string | NamedRef | null | undefined;

export interface ProfileGroup { membership_id: number; group_id: number; group_name: string; subject?: RefValue; role: string; status: string; joined_at: string | null }
export interface ProfileEnrollment { id: number; status: string; created_at: string; items: { subject: RefValue; status: string }[] }
export interface ProfileFile { id: number; title: string; created_at: string; status: string }
export interface ProfilePrintOrder { id: number; status: string; total: string | number | null; created_at: string; currency?: string | null }
export interface ProfileTicket { id: number; subject: string; status: string; created_at: string }
export interface ProfileVerification { id: number; status: string; created_at: string; reviewed_at: string | null; note: string | null }

export interface StudentDetail {
  user: { id: number; full_name: string; email: string | null; phone_number: string | null; job_title: string | null; is_active: boolean; last_login: string | null; created_at: string; role?: string };
  profile: {
    university?: RefValue; faculty?: RefValue; major?: RefValue; academic_year?: RefValue; semester?: RefValue;
    student_number?: string | null; verification_status?: string | null; needs_term_confirmation?: boolean;
  } | null;
  groups: ProfileGroup[];
  enrollments: ProfileEnrollment[];
  files: ProfileFile[];
  print_orders: ProfilePrintOrder[];
  support_tickets: ProfileTicket[];
  verification_history: ProfileVerification[];
  counts?: Partial<Record<"groups" | "enrollments" | "files" | "print_orders" | "support_tickets" | "verification_history", number>>;
}

/** A relation may arrive as a plain string, `{id, name}` or null. */
export function refName(value: RefValue): string {
  if (!value) return "";
  return typeof value === "string" ? value : (value.name ?? "");
}

/** Count to show on a tab: the server total when given, otherwise the length of the (capped) list. */
export function tabCount(detail: StudentDetail, key: keyof NonNullable<StudentDetail["counts"]>): number {
  const total = detail.counts?.[key];
  return typeof total === "number" ? total : detail[key].length;
}

/** True when the list shown is a capped sample of a bigger total. */
export function isTruncated(detail: StudentDetail, key: keyof NonNullable<StudentDetail["counts"]>): boolean {
  return tabCount(detail, key) > detail[key].length;
}

/** Same-origin profile ids only: guards deep links such as `/users/12abc`. */
export function parseUserId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && /^\d{1,12}$/u.test(value) ? Number(value) : null;
}
