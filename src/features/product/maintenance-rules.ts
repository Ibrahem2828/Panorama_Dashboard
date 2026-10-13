/** Maintenance-window helpers: the backend keeps one row per window and serves the newest enabled one. */

export interface MaintenanceRecord {
  id?: unknown;
  enabled?: unknown;
  is_currently_active?: unknown;
  updated_at?: unknown;
  [key: string]: unknown;
}

export type MaintenanceState = "off" | "on" | "scheduled";

/** Rows flagged `enabled` (a disable must switch every one of them off or the newest remaining one keeps blocking users). */
export function enabledWindows<T extends MaintenanceRecord>(records: readonly T[]): T[] {
  return records.filter((record) => record.enabled === true);
}

export function maintenanceState(records: readonly MaintenanceRecord[]): MaintenanceState {
  const enabled = enabledWindows(records);
  if (!enabled.length) return "off";
  return enabled.some((record) => record.is_currently_active === true) ? "on" : "scheduled";
}

/** The window the "update notice" form edits: the most recently updated enabled row. */
export function editableWindow<T extends MaintenanceRecord>(records: readonly T[]): T | null {
  const time = (record: T) => (typeof record.updated_at === "string" ? Date.parse(record.updated_at) : 0) || 0;
  const enabled = enabledWindows(records);
  if (!enabled.length) return null;
  return enabled.reduce((best, record) => (time(record) > time(best) ? record : best));
}

/** Per-record idempotency key for a multi-request action: stable for retries of the same submit, valid for the backend format. */
export function derivedIdempotencyKey(baseKey: string, id: unknown): string {
  return `${baseKey}-${String(id)}`;
}
