export const SUPPORTED_LOCALES = ["ar", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ar";

export const DEFAULT_COOKIE_NAMES = {
  access: "panorama_access",
  refresh: "panorama_refresh",
  csrf: "panorama_csrf",
} as const;

export const DASHBOARD_ROLES = [
  "it_support",
  "admin",
  "print_staff",
  "support_staff",
  "content_manager",
] as const;

export type DashboardRole = (typeof DASHBOARD_ROLES)[number];

/** End-user roles that must never obtain a dashboard session, whatever capabilities the backend lists. */
export const END_USER_ROLES = ["student", "normal_user"] as const;
