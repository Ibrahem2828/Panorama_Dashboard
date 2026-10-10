import { NextRequest, NextResponse } from "next/server";

import { clearSessionCookies, setSessionCookies } from "@/lib/auth/cookies";
import { loadSessionResult } from "@/lib/auth/server-session";
import { jsonError } from "@/lib/security/http";
import { requestId } from "@/lib/security/request-id";

export async function GET(request: NextRequest) {
  const id = requestId(request);
  try {
    const result = await loadSessionResult();
    if (result.session) {
      const response = NextResponse.json({ success: true, data: result.session, message: "Session loaded." }, {
        headers: { "x-request-id": result.upstreamRequestId ?? id, "cache-control": "no-store, private" },
      });
      // The BFF refresh is server-side. Only replacement HttpOnly cookies leave
      // this route; token values never enter the session JSON payload.
      if (result.refreshedTokens) setSessionCookies(response, result.refreshedTokens);
      return response;
    }

    if (result.status === 403) {
      const response = jsonError(403, "DASHBOARD_ACCESS_DENIED", "Dashboard access is not allowed.", result.upstreamRequestId ?? id);
      if (result.refreshedTokens) setSessionCookies(response, result.refreshedTokens);
      return response;
    }
    if (result.status === 429) {
      const response = jsonError(429, "SESSION_REFRESH_RATE_LIMITED", "Session refresh is temporarily rate limited.", result.upstreamRequestId ?? id);
      if (result.retryAfter) response.headers.set("retry-after", result.retryAfter);
      return response;
    }
    if (result.status >= 500 || result.status === 502 || result.status === 504) {
      const response = jsonError(503, "SESSION_BACKEND_UNAVAILABLE", "Unable to validate the session.", result.upstreamRequestId ?? id);
      if (result.refreshedTokens) setSessionCookies(response, result.refreshedTokens);
      return response;
    }

    {
      const response = jsonError(401, "SESSION_INVALID", "Session is invalid or expired.", id);
      clearSessionCookies(response);
      return response;
    }
  } catch {
    return jsonError(503, "SESSION_BACKEND_UNAVAILABLE", "Unable to validate the session.", id);
  }
}

