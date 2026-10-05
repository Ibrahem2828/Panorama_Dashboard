import "server-only";

function normalizeBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(normalized)) {
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
  secureCookies: isProduction,
  enableApiDebug: bool(process.env.ENABLE_API_DEBUG),
  isProduction,
  allowRoleCapabilityFallback,
} as const;
