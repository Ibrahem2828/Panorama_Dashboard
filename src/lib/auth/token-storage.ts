import type { AuthTokens, User } from "@/types/auth";
import type { UserRole } from "@/types/roles";
import { isDashboardRole as isAllowedDashboardRole } from "@/lib/permissions";

const ACCESS_TOKEN_KEY = "panorama.access_token";
const REFRESH_TOKEN_KEY = "panorama.refresh_token";
const USER_KEY = "panorama.user";

// Current dashboard MVP keeps JWTs in localStorage behind this isolated module.
// Future production hardening should move tokens to secure HttpOnly cookies when the backend supports it.
function safeStorage() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

export function getAccessToken() {
  return safeStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
}

export function getRefreshToken() {
  return safeStorage()?.getItem(REFRESH_TOKEN_KEY) ?? null;
}

export function setTokens(tokens: AuthTokens) {
  const storage = safeStorage();
  if (!storage) {
    return;
  }
  storage.setItem(ACCESS_TOKEN_KEY, tokens.access);
  storage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
}

export function setAccessToken(access: string) {
  safeStorage()?.setItem(ACCESS_TOKEN_KEY, access);
}

export function setRefreshToken(refresh: string) {
  safeStorage()?.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function setUser(user: User) {
  safeStorage()?.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): User | null {
  const rawUser = safeStorage()?.getItem(USER_KEY);
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as User;
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession() {
  const storage = safeStorage();
  if (!storage) {
    return;
  }
  storage.removeItem(ACCESS_TOKEN_KEY);
  storage.removeItem(REFRESH_TOKEN_KEY);
  storage.removeItem(USER_KEY);
}

export function isDashboardRole(role?: UserRole | null) {
  return isAllowedDashboardRole(role);
}
