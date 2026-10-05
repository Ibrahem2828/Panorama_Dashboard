import { DEFAULT_LOCALE } from "@/config/constants";

export const publicEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Panorama Dashboard",
  appEnvironment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  defaultLocale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? DEFAULT_LOCALE,
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@panorama.local",
  csrfCookieName: process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME ?? "panorama_csrf",
} as const;
