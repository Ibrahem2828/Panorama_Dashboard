import "server-only";

import crypto from "node:crypto";
import { NextRequest } from "next/server";

import { serverEnv } from "@/config/env.server";

export class SecurityError extends Error {
  constructor(message: string, readonly status = 403, readonly code = "SECURITY_CHECK_FAILED") {
    super(message);
  }
}

export function newCsrfToken() { return crypto.randomBytes(32).toString("base64url"); }

/**
 * In the standalone server `request.url` carries the container's bind address (HOSTNAME=0.0.0.0), not the public
 * host, so the browser's Origin would never match. Prefer the configured public origin, then the proxy's forwarded
 * headers (Traefik sets them and a browser cannot forge them cross-site), then the request URL.
 */
function expectedOrigin(request: NextRequest): string {
  if (serverEnv.appOrigin) return serverEnv.appOrigin;
  const first = (value: string | null) => value?.split(",")[0]?.trim() || null;
  const host = first(request.headers.get("x-forwarded-host")) ?? first(request.headers.get("host"));
  const proto = first(request.headers.get("x-forwarded-proto")) ?? new URL(request.url).protocol.replace(":", "");
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

function assertSameOrigin(request: NextRequest) {
  const ownOrigin = expectedOrigin(request);
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin !== ownOrigin) throw new SecurityError("Cross-origin request rejected.", 403, "ORIGIN_REJECTED");
  if (referer && new URL(referer).origin !== ownOrigin) throw new SecurityError("Cross-origin request rejected.", 403, "REFERER_REJECTED");
  if (fetchSite && fetchSite !== "same-origin") throw new SecurityError("Cross-site request rejected.", 403, "FETCH_SITE_REJECTED");
}

export function assertBrowserOrigin(request: NextRequest) { assertSameOrigin(request); }

export function assertCsrf(request: NextRequest) {
  assertSameOrigin(request);
  const cookie = request.cookies.get(serverEnv.cookieNames.csrf)?.value;
  const header = request.headers.get("x-panorama-csrf");
  if (!cookie || !header || cookie.length < 24 || header.length !== cookie.length) {
    throw new SecurityError("CSRF validation failed.", 403, "CSRF_VALIDATION_FAILED");
  }
  if (!crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(header))) {
    throw new SecurityError("CSRF validation failed.", 403, "CSRF_VALIDATION_FAILED");
  }
}
