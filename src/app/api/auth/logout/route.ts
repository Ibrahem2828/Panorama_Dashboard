import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { serverEnv } from "@/config/env.server";
import { backendFetch } from "@/lib/api/backend";
import { clearSessionCookies } from "@/lib/auth/cookies";
import { assertCsrf, SecurityError } from "@/lib/security/csrf";
import { jsonError } from "@/lib/security/http";
import { requestId } from "@/lib/security/request-id";

export async function POST(request: NextRequest) {
  const id = requestId(request);
  try {
    assertCsrf(request);
    const access = request.cookies.get(serverEnv.cookieNames.access)?.value;
    const refresh = request.cookies.get(serverEnv.cookieNames.refresh)?.value;
    if (refresh) {
      await backendFetch("/api/v1/auth/logout/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": id,
          "Idempotency-Key": crypto.randomUUID(),
          ...(access ? { Authorization: `Bearer ${access}` } : {}),
        },
        body: JSON.stringify({ refresh }),
      }).catch(() => null);
    }
    const response = NextResponse.json({ success: true, data: null, message: "Logged out." }, {
      headers: { "x-request-id": id, "cache-control": "no-store" },
    });
    clearSessionCookies(response);
    return response;
  } catch (error) {
    if (error instanceof SecurityError) return jsonError(error.status, error.code, error.message, id);
    const response = jsonError(500, "LOGOUT_GATEWAY_FAILED", "Logout failed.", id);
    clearSessionCookies(response);
    return response;
  }
}
