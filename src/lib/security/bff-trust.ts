import { trustedClientIp } from "@/lib/rate-limit";

/**
 * Headers that tell the backend who the real client is.
 *
 * Traefik sits between this BFF and the backend and overwrites X-Forwarded-For with the BFF's own address, so the
 * backend would throttle every dashboard user as one client. When BFF_SHARED_SECRET is configured (same value on the
 * backend), the secret authenticates this server as a trusted source for X-Panorama-Client-IP. Without the secret only
 * the plain X-Forwarded-For is sent (the backend ignores the dedicated headers). The secret never reaches the browser.
 */
export function bffTrustHeaders(requestHeaders: Headers, secret: string | undefined = process.env.BFF_SHARED_SECRET): Record<string, string> {
  const ip = trustedClientIp(requestHeaders);
  if (!ip) return {};
  const out: Record<string, string> = { "X-Forwarded-For": ip };
  const trimmed = secret?.trim();
  if (trimmed) {
    out["X-Panorama-BFF-Secret"] = trimmed;
    out["X-Panorama-Client-IP"] = ip;
  }
  return out;
}
