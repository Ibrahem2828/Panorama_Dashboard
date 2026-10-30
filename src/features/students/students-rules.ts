import type { FilterField, FilterOption, FilterSchema } from "@/components/filters/filter-types";
import type { MessageKey } from "@/i18n/messages";

/** Backend `verification_status` values of a student, in the order the segments show them. */
export const VERIFICATION_STATUSES = ["approved", "pending", "needs_update", "rejected", "incomplete", "suspended"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const STUDENT_SORTS = ["-created_at", "created_at", "full_name", "-full_name", "-last_login", "last_login", "student_number"] as const;
export const DEFAULT_STUDENT_SORT = "-created_at";

interface Named { id: number; name: string }

/** Row of `GET dashboard/students/`. */
export interface StudentRow {
  id: number;
  full_name: string;
  email: string;
  phone_number: string | null;
  student_number: string | null;
  verification_status: VerificationStatus | string;
  is_verified: boolean;
  university: Named | null;
  faculty: Named | null;
  major: Named | null;
  academic_year: Named | null;
  semester: Named | null;
  is_active: boolean;
  needs_term_confirmation: boolean;
  last_login: string | null;
  created_at: string;
  groups_count: number;
  pending_enrollments: number;
}

/** `GET dashboard/students/summary/`. */
export interface StudentSummary {
  total: number;
  by_verification_status: Partial<Record<VerificationStatus, number>>;
}

/** Message key of a verification status (segment tab and badge). */
export const STATUS_LABEL_KEY: Record<VerificationStatus, MessageKey> = {
  approved: "students.status.approved",
  pending: "students.status.pending",
  needs_update: "students.status.needs_update",
  rejected: "students.status.rejected",
  incomplete: "students.status.incomplete",
  suspended: "students.status.suspended",
};

export function isVerificationStatus(value: unknown): value is VerificationStatus {
  return typeof value === "string" && (VERIFICATION_STATUSES as readonly string[]).includes(value);
}

export interface StudentFieldInput {
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  /** Faculty, major, year, semester and university (see `academicFields`). */
  academic: readonly FilterField[];
  groups: readonly FilterOption[];
}

/**
 * Filter definition of the students page. Primary: faculty -> major, year, semester. Advanced: everything else the
 * `dashboard/students/` endpoint understands. Parameter names are the endpoint's.
 */
export function studentFields(input: StudentFieldInput): FilterField[] {
  const { t } = input;
  return [
    ...input.academic,
    { kind: "boolean", key: "is_active", label: t("students.filter.accountStatus"), yesLabel: t("common.active"), noLabel: t("students.disabled"), placement: "advanced" },
    { kind: "boolean", key: "has_pending_enrollment", label: t("students.filter.pendingEnrollment"), placement: "advanced" },
    { kind: "boolean", key: "no_groups", label: t("students.filter.noGroups"), placement: "advanced" },
    { kind: "boolean", key: "needs_term_confirmation", label: t("students.filter.termConfirmation"), placement: "advanced" },
    { kind: "select", key: "group", label: t("students.filter.group"), options: input.groups, placement: "advanced" },
    { kind: "date-range", key: "registered", fromKey: "registered_after", toKey: "registered_before", label: t("students.filter.registered"), placement: "advanced" },
    { kind: "number", key: "inactive_days", label: t("students.filter.inactiveDays"), unit: t("students.filter.days"), placement: "advanced" },
  ];
}

export function studentSchema(fields: readonly FilterField[]): FilterSchema {
  return { fields, searchParam: "search", segmentParam: "verification_status", sortParam: "ordering", defaultSort: DEFAULT_STUDENT_SORT };
}

/** The summary endpoint takes every filter except the one the segments split by (and no sorting). */
export const SUMMARY_OMIT = ["verification_status", "ordering"] as const;

const csvCell = (value: string | number | boolean | null | undefined): string => {
  const text = value === null || value === undefined ? "" : String(value);
  // A cell that starts like a formula is neutralised so a name cannot run in a spreadsheet.
  const safe = /^[=+\-@\t\r]/u.test(text) && !/^-?\d+(?:\.\d+)?$/u.test(text) ? `'${text}` : text;
  return /[",\n\r]/u.test(safe) ? `"${safe.replace(/"/gu, '""')}"` : safe;
};

/** CSV (BOM so Excel reads Arabic) of the rows currently on screen; `labels` are the column titles in the user's language. */
export function studentsCsv(rows: readonly StudentRow[], labels: readonly string[], statusLabel: (status: string) => string): string {
  const lines = [labels.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push([
      row.full_name, row.student_number, row.email, row.phone_number, statusLabel(row.verification_status),
      row.university?.name, row.faculty?.name, row.major?.name, row.academic_year?.name, row.semester?.name,
      row.groups_count, row.pending_enrollments, row.is_active ? "1" : "0", row.last_login, row.created_at,
    ].map(csvCell).join(","));
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
