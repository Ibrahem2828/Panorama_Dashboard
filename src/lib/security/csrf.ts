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

function assertSameOrigin(request: NextRequest) {
  const ownOrigin = new URL(request.url).origin;
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
