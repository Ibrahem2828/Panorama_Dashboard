export type ServiceProbe = "up" | "maintenance" | "down";

/**
 * Asks the BFF whether the platform is serving again. The backend's own health endpoints are exempt from maintenance
 * mode, so they cannot signal its end: after the BFF itself answers, a lightweight read of a regular endpoint is used.
 * A 401 from that read means the BFF and backend answer (the session is dealt with separately), so it counts as "up".
 * Never throws.
 */
export async function probeService(fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<ServiceProbe> {
  try {
    const init = { cache: "no-store", credentials: "same-origin", signal } as const;
    // Only the BFF itself must be reachable here: its aggregate health also reports backend maintenance as 503.
    const health = await fetchImpl("/api/health/live", init);
    if (!health.ok) return "down";
    const probe = await fetchImpl("/api/backend/api/v1/academic-years/?page_size=1", init);
    if (probe.status === 503) {
      let code: unknown;
      try {
        code = ((await probe.json()) as { code?: unknown }).code;
      } catch {
        /* non-JSON body */
      }
      return code === "MAINTENANCE_MODE" ? "maintenance" : "down";
    }
    if (probe.status >= 500) return "down";
    return "up";
  } catch {
    return "down";
  }
}

export const MIN_RETRY_SECONDS = 5;
export const DEFAULT_RETRY_SECONDS = 30;
export const MAX_RETRY_SECONDS = 300;

/** Seconds to wait before the next automatic check: the server's Retry-After (clamped), growing after each failed check. */
export function nextCheckDelaySeconds(retryAfterSeconds: number | undefined, failedChecks: number): number {
  const base = Math.min(MAX_RETRY_SECONDS, Math.max(MIN_RETRY_SECONDS, retryAfterSeconds ?? DEFAULT_RETRY_SECONDS));
  return Math.min(MAX_RETRY_SECONDS, Math.round(base * 1.5 ** Math.min(failedChecks, 6)));
}

/** Whole seconds left until `deadline` (never negative). */
export function secondsRemaining(deadline: number | null, now: number): number {
  return deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
}
