/** Normalises GET /dashboard/devices/stats/ (`{total, active, revoked, push_enabled, by_platform, top_versions}`). */

export interface CountItem { label: string; count: number }
export interface DeviceStats { total: number; active: number; revoked: number; pushEnabled: number; byPlatform: CountItem[]; topVersions: CountItem[] }

const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

function items(value: unknown, labelKey: string): CountItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Record<string, unknown>;
    const label = raw[labelKey];
    return typeof label === "string" && label ? [{ label, count: count(raw.count) }] : [];
  });
}

export function deviceStats(payload: unknown): DeviceStats {
  const raw = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  return {
    total: count(raw.total),
    active: count(raw.active),
    revoked: count(raw.revoked),
    pushEnabled: count(raw.push_enabled),
    byPlatform: items(raw.by_platform, "platform"),
    topVersions: items(raw.top_versions, "app_version"),
  };
}
