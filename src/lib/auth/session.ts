import { clearSession, getAccessToken, getRefreshToken, getUser } from "@/lib/auth/token-storage";
import { isDashboardRole } from "@/lib/permissions";

export function hasValidDashboardSession() {
  const user = getUser();
  return Boolean(getAccessToken() && getRefreshToken() && user && isDashboardRole(user.role));
}

export function clearInvalidSession() {
  const user = getUser();
  if (!user || !isDashboardRole(user.role)) {
    clearSession();
  }
}
