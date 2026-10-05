import { NextRequest, NextResponse } from "next/server";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "@/config/constants";
/** Canonical destinations for routes that existed before locale-scoped routing. */
const LEGACY_ROUTE_ALIASES: Readonly<Record<string, string>> = {
  "/login": "/login",
  "/forgot-password": "/login",
  "/academic": "/dashboard/academic",
  "/academic/academic-years": "/dashboard/academic/academic-years",
  "/academic/faculties": "/dashboard/academic/faculties",
  "/academic/majors": "/dashboard/academic/majors",
  "/academic/semesters": "/dashboard/academic/semesters",
  "/academic/subjects": "/dashboard/academic/subjects",
  "/academic/universities": "/dashboard/academic/universities",
  "/announcements": "/dashboard/announcements",
  "/audit-logs": "/dashboard/audit",
  "/files": "/dashboard/files",
  "/groups": "/dashboard/groups",
  "/notifications": "/dashboard/notifications",
  "/printing": "/dashboard/printing",
  "/settings": "/dashboard/settings",
  "/support": "/dashboard/support",
  "/verification": "/dashboard/verifications",
  "/student-account-requests": "/dashboard/verifications",
};

function canonicalLegacyPath(pathname: string) {
  if (pathname.startsWith("/student-account-requests/")) return "/dashboard/verifications";
  return LEGACY_ROUTE_ALIASES[pathname] ?? pathname;
}

function isLocale(value: string | undefined): value is Locale {
  return Boolean(value && SUPPORTED_LOCALES.includes(value as Locale));
}

function createNonce() {
  return btoa(crypto.randomUUID()).replace(/=+$/u, "");
}

function applyRequestSecurityHeaders(response: NextResponse, nonce: string, csp: string) {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);
  return response;
}
function contentSecurityPolicy(nonce: string) {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const nonce = createNonce();
  const requestHeaders = new Headers(request.headers);
  const csp = contentSecurityPolicy(nonce);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  if (pathname === "/") {
    return applyRequestSecurityHeaders(NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}/login`, request.url)), nonce, csp);
  }

  const segments = pathname.split("/").filter(Boolean);
  const locale = isLocale(segments[0]) ? segments[0] : undefined;

  if (!locale && !pathname.startsWith("/api/") && !pathname.startsWith("/_next/")) {
    const destination = new URL(`/${DEFAULT_LOCALE}${canonicalLegacyPath(pathname)}`, request.url);
    destination.search = request.nextUrl.search;
    return applyRequestSecurityHeaders(NextResponse.redirect(destination), nonce, csp);
  }

  const response = applyRequestSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), nonce, csp);

  if (locale) {
    response.headers.set("x-panorama-locale", locale);
    if (segments.length === 1) {
      // Session cookies deliberately use Path=/api. Page middleware cannot see
      // them, so the BFF session endpoint is the authentication source of truth.
      return applyRequestSecurityHeaders(NextResponse.redirect(new URL(`/${locale}/login`, request.url)), nonce, csp);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
