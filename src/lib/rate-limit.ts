import { isIP } from "node:net";

/**
 * Address of the client as seen by the single trusted reverse proxy in front of this app: the LAST X-Forwarded-For hop,
 * because the proxy appends the peer it saw. Earlier hops are client-supplied and spoofable. Null when absent/invalid
 * (e.g. direct access in local development).
 */
export function trustedClientIp(headers: Headers): string | null {
  const hops = headers.get("x-forwarded-for")?.split(",") ?? [];
  const last = hops[hops.length - 1]?.trim();
  return last && isIP(last) ? last : null;
}
