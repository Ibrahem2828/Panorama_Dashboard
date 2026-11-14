/**
 * Pure rules of the staff view of offline lecture licenses
 * (`GET /api/v1/dashboard/lectures/offline-licenses/?user=&lecture=` and `POST .../revoke/`).
 * The staff endpoints return an untyped object in the OpenAPI contract, so the row type lives here.
 */
import type { MessageKey } from "@/i18n/messages";

export type OfflineLicenseState = "active" | "expired" | "revoked";

export interface OfflineLicenseRow {
  license_id: string;
  lecture_id: number;
  lecture_title: string;
  user_id: number;
  /** First characters of the device hash only; the raw device id never reaches the backend responses. */
  device: string;
  issued_at: string | null;
  expires_at: string | null;
  state: OfflineLicenseState | string;
  revoked_at: string | null;
  revoke_reason: string | null;
  renew_count?: number;
}

export interface LicenseGroup {
  lectureId: number;
  title: string;
  rows: OfflineLicenseRow[];
  /** Licenses that can still be revoked (not revoked yet). */
  revocable: number;
  active: number;
}

/** The staff list is capped server side; at this many rows the count shown may be a lower bound. */
export const STAFF_LIST_CAP = 200;

const STATE_KEYS: Record<OfflineLicenseState, MessageKey> = {
  active: "offlineLicenses.state.active",
  expired: "offlineLicenses.state.expired",
  revoked: "offlineLicenses.state.revoked",
};

export function normalizeState(state: string | null | undefined): OfflineLicenseState {
  return state === "active" || state === "revoked" ? state : "expired";
}

export function stateLabelKey(state: string | null | undefined): MessageKey {
  return STATE_KEYS[normalizeState(state)];
}

/** `StatusPill` value that gives the right colour: green, amber, red. */
export function statePillValue(state: string | null | undefined): "active" | "pending" | "blocked" {
  const normalized = normalizeState(state);
  return normalized === "active" ? "active" : normalized === "revoked" ? "blocked" : "pending";
}

const REASONS = [
  "membership_ended", "access_lost", "lecture_unavailable", "lecture_replaced",
  "released_by_device", "revoked_by_staff", "device_replaced", "account_disabled", "expired",
] as const;

/** Message key of a known revoke reason; `null` for unknown or empty reasons (show the raw code instead). */
export function revokeReasonKey(reason: string | null | undefined): MessageKey | null {
  return reason && (REASONS as readonly string[]).includes(reason) ? (`offlineLicenses.reason.${reason}` as MessageKey) : null;
}

/** Device hash prefix, masked: never shows more than 8 characters. */
export function maskDevice(device: string | null | undefined): string {
  const value = (device ?? "").trim().slice(0, 8);
  return value ? `${value}…` : "—";
}

/** A license can be revoked until it is revoked; expired ones too, so a renewal can no longer resurrect them. */
export function isRevocable(row: Pick<OfflineLicenseRow, "state">): boolean {
  return normalizeState(row.state) !== "revoked";
}

/** The reason is only meaningful for licenses that ended: revoked, or expired with a recorded reason. */
export function shouldShowReason(row: Pick<OfflineLicenseRow, "state" | "revoke_reason">): boolean {
  return Boolean(row.revoke_reason) && normalizeState(row.state) !== "active";
}

export function activeCount(rows: readonly Pick<OfflineLicenseRow, "state">[]): number {
  return rows.filter((row) => normalizeState(row.state) === "active").length;
}

/** Rows grouped by lecture (first-seen order, newest-issued first inside a group). */
export function groupByLecture(rows: readonly OfflineLicenseRow[]): LicenseGroup[] {
  const groups = new Map<number, LicenseGroup>();
  for (const row of rows) {
    let group = groups.get(row.lecture_id);
    if (!group) {
      group = { lectureId: row.lecture_id, title: row.lecture_title, rows: [], revocable: 0, active: 0 };
      groups.set(row.lecture_id, group);
    }
    group.rows.push(row);
  }
  for (const group of groups.values()) {
    group.rows.sort((a, b) => Date.parse(b.issued_at ?? "") - Date.parse(a.issued_at ?? "") || 0);
    group.revocable = group.rows.filter(isRevocable).length;
    group.active = activeCount(group.rows);
  }
  return [...groups.values()];
}

/** Body of the staff revoke call: one lecture, or every license of the user when `lectureId` is omitted. */
export function revokeBody(userId: number, lectureId?: number): { user_id: number; lecture_id?: number } {
  return lectureId === undefined ? { user_id: userId } : { user_id: userId, lecture_id: lectureId };
}

/** Number of revoked licenses from the revoke response (`{revoked: n}`), tolerant of envelope shapes. */
export function revokedCount(payload: unknown): number {
  const data = (payload as { data?: unknown } | null)?.data ?? payload;
  const value = (data as { revoked?: unknown } | null)?.revoked;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function offlineLicensesPath(filter: { user?: number; lecture?: number }): string {
  const params = new URLSearchParams();
  if (filter.user !== undefined) params.set("user", String(filter.user));
  if (filter.lecture !== undefined) params.set("lecture", String(filter.lecture));
  return `/api/v1/dashboard/lectures/offline-licenses/?${params.toString()}`;
}
