import type { FilterField, FilterOption, FilterSchema } from "@/components/filters/filter-types";
import { GROUP_KINDS, KIND_LABEL_KEY } from "@/features/groups/groups-filters";
import type { MessageKey } from "@/i18n/messages";

/**
 * Contract of `GET dashboard/group-join-requests/` and friends (backend branch feat/enrollment-only-joining).
 * Students enter their groups when a subject-registration request is approved; this screen only works through the old
 * pending requests. Single decisions reuse the per-membership actions of the groups module.
 */
export const JOIN_REQUEST_ROUTE = "/dashboard/groups/requests";
export const JOIN_REQUESTS_PATH = "/api/v1/dashboard/group-join-requests/";
export const JOIN_REQUESTS_SUMMARY_PATH = "/api/v1/dashboard/group-join-requests/summary/";
export const JOIN_REQUESTS_BULK_PATH = "/api/v1/dashboard/group-join-requests/bulk-decision/";
export const SUBJECT_REGISTRATION_ROUTE = "/dashboard/enrollment";
/** Backend limit of ids per bulk call. */
export const BULK_LIMIT = 100;

/** Status segments, in display order. The empty value is the default (pending): the URL stays clean for the review queue. */
export const JOIN_REQUEST_STATUSES = ["pending", "approved", "rejected"] as const;
export type JoinRequestStatus = (typeof JOIN_REQUEST_STATUSES)[number];

export interface JoinRequestRow {
  id: number;
  created_at: string;
  status: string;
  user: { id: number; full_name: string; email: string; student_number: string | null; verification_status: string };
  group: {
    id: number;
    name: string;
    kind: string;
    subject: { id: number; name: string } | null;
    faculty: { id: number; name: string } | null;
    academic_year: string | null;
    semester: string | null;
  };
  reviewed_by: { id: number; full_name: string } | null;
  reviewed_at: string | null;
  note: string;
}

export interface JoinRequestSummary { pending: number; approved_today: number; rejected_today: number }

export interface BulkItemResult { id: number; ok: boolean; error?: string }
export type BulkDecision = "approve" | "reject";

/** The filter schema: status is the segment, `group` etc. are query parameters of the list endpoint. */
export function joinRequestSchema(fields: readonly FilterField[]): FilterSchema {
  return { fields, searchParam: "search", segmentParam: "status" };
}

export function joinRequestFields(args: {
  t: (key: MessageKey) => string;
  academic: readonly FilterField[];
  groups: readonly FilterOption[];
  subjects: readonly FilterOption[];
}): FilterField[] {
  const { t, academic, groups, subjects } = args;
  // Primary: group + faculty + year + semester. The academic bundle also carries major/university: only the wanted ones stay.
  const keep = new Set(["faculty", "academic_year", "semester"]);
  return [
    { kind: "select", key: "group", label: t("filters.group"), options: groups, placement: "primary" },
    ...academic.filter((field) => keep.has(field.key)).map((field) => ({ ...field, placement: "primary" as const })),
    { kind: "select", key: "kind", label: t("joinRequests.filter.kind"), options: GROUP_KINDS.map((value) => ({ value, label: t(KIND_LABEL_KEY[value]) })), placement: "advanced" },
    { kind: "select", key: "subject", label: t("filters.subject"), options: subjects, placement: "advanced" },
    { kind: "date-range", key: "created", fromKey: "created_after", toKey: "created_before", label: t("joinRequests.filter.requestedRange"), placement: "advanced" },
  ];
}

/** Query of the list: the status defaults to pending and the newest request comes first. */
export function joinRequestListParams(requestParams: Record<string, string>): Record<string, string> {
  return { ...requestParams, status: requestParams.status || "pending", ordering: "-created_at" };
}

/** Query of the summary: every filter except the status (the three counters are the segments). */
export function joinRequestSummaryParams(requestParams: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(requestParams).filter(([name]) => name !== "status" && name !== "ordering"));
}

/** Link to this screen, optionally narrowed to one group (used by the group members dialog). */
export function joinRequestsHref(groupId?: number | string | null): string {
  return groupId === null || groupId === undefined || groupId === "" ? JOIN_REQUEST_ROUTE : `${JOIN_REQUEST_ROUTE}?group=${encodeURIComponent(String(groupId))}`;
}

/** Reads the `ids` results of the bulk call: every id must come back, a missing one counts as failed. */
export function normalizeBulkResults(payload: unknown, ids: readonly number[]): BulkItemResult[] {
  const raw = Array.isArray(payload) ? payload : payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown }).results) ? (payload as { results: unknown[] }).results : [];
  const byId = new Map<number, BulkItemResult>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const id = Number(entry.id);
    if (Number.isFinite(id)) byId.set(id, { id, ok: entry.ok === true, error: typeof entry.error === "string" ? entry.error : undefined });
  }
  return ids.map((id) => byId.get(id) ?? { id, ok: false, error: "missing" });
}

export function failedResults(results: readonly BulkItemResult[]): BulkItemResult[] {
  return results.filter((result) => !result.ok);
}

/**
 * Old notifications still carry the legacy target `/dashboard/groups?highlight=<group id>`: group join requests now live
 * on their own screen, so a notification of the join-request category with such a link opens it filtered to that group.
 */
export function joinRequestNotificationLink(link: string | null | undefined, category?: string | null): string {
  const value = (link ?? "").trim();
  if (category !== "join_request") return value;
  const legacy = /^\/dashboard\/groups\?(?:[^#]*&)?highlight=(\d+)(?:&|$)/u.exec(value);
  if (legacy) return joinRequestsHref(legacy[1]);
  if (/^\/dashboard\/groups\/?$/u.test(value)) return JOIN_REQUEST_ROUTE;
  return value;
}
