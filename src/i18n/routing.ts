import type { Locale } from "@/config/constants";

export function localizePath(locale: Locale, path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalized}`;
}

export function switchLocalePath(pathname: string, locale: Locale) {
  const segments = pathname.split("/");
  if (segments.length > 1) segments[1] = locale;
  return segments.join("/") || `/${locale}`;
}
