import "server-only";

function normalizeBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "");
  // Plain HTTP is only for a local full-stack run and must be opted into explicitly.
  const allowInsecure = process.env.ALLOW_INSECURE_BACKEND === "true" && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(normalized);
  if (!/^https:\/\//i.test(normalized) && !allowInsecure) {
    throw new Error("BACKEND_API_BASE_URL must use https");
  }

  return normalized;
}

function timeoutMs(value: string | undefined): number {
  const parsed = Number(value ?? 12_000);
  if (!Number.isFinite(parsed) || parsed < 1_000 || parsed > 60_000) {
    throw new Error("BACKEND_REQUEST_TIMEOUT_MS must be between 1000 and 60000");
  }
  return Math.floor(parsed);
}

function bool(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined) return defaultValue;
  return value.trim().toLowerCase() === "true";
}

const isProduction = process.env.NODE_ENV === "production";
const allowRoleCapabilityFallback = bool(process.env.ALLOW_ROLE_CAPABILITY_FALLBACK);

if (isProduction && allowRoleCapabilityFallback) {
  throw new Error("ALLOW_ROLE_CAPABILITY_FALLBACK must be disabled in production");
}

export const serverEnv = {
  backendApiBaseUrl: normalizeBaseUrl(
    process.env.BACKEND_API_BASE_URL ?? "https://api.xn--mgbaab0cxheq.tech",
  ),
  requestTimeoutMs: timeoutMs(process.env.BACKEND_REQUEST_TIMEOUT_MS),
  cookieNames: {
    access: "panorama_access",
    refresh: "panorama_refresh",
    csrf: "panorama_csrf",
  },
  secureCookies: process.env.SECURE_COOKIES ? process.env.SECURE_COOKIES === "true" : isProduction,
  /** Public origin of the dashboard (strict Origin check behind a TLS-terminating proxy). Optional. */
  appOrigin: process.env.APP_ORIGIN?.trim().replace(/\/+$/, "") || null,
  enableApiDebug: bool(process.env.ENABLE_API_DEBUG),
  isProduction,
  allowRoleCapabilityFallback,
} as const;
