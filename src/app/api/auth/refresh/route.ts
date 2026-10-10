import { NextRequest, NextResponse } from "next/server";

import { clearSessionCookies, setSessionCookies } from "@/lib/auth/cookies";
import { readTokens, refreshTokensResult } from "@/lib/auth/server-session";
import { assertCsrf, SecurityError } from "@/lib/security/csrf";
import { jsonError } from "@/lib/security/http";
import { requestId } from "@/lib/security/request-id";

export async function POST(request: NextRequest) {
  const id = requestId(request);
  try {
    assertCsrf(request);
    const refresh = readTokens(request).refresh;
    if (!refresh) {
      const response = jsonError(401, "SESSION_INVALID", "Session is invalid or expired.", id);
      clearSessionCookies(response);
      return response;
    }
    const refreshed = await refreshTokensResult(refresh);
    if (!refreshed.tokens) {
      const response = jsonError(
        refreshed.status,
        refreshed.status >= 500 ? "SESSION_BACKEND_UNAVAILABLE" : "SESSION_INVALID",
        refreshed.status >= 500 ? "Unable to refresh the session." : "Session is invalid or expired.",
        id,
      );
      response.headers.set("x-request-id", refreshed.upstreamRequestId ?? id);
      if (refreshed.retryAfter) response.headers.set("retry-after", refreshed.retryAfter);
      if (refreshed.status === 400 || refreshed.status === 401 || refreshed.status === 403) clearSessionCookies(response);
      return response;
    }
    const response = NextResponse.json({ success: true, data: { refreshed: true } }, { headers: { "x-request-id": id, "cache-control": "no-store" } });
    setSessionCookies(response, refreshed.tokens);
    return response;
  } catch (error) {
    const response = error instanceof SecurityError
      ? jsonError(error.status, error.code, error.message, id)
      : jsonError(401, "SESSION_INVALID", "Session is invalid or expired.", id);
    clearSessionCookies(response);
    return response;
  }
}
