import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  BackendInvalidJsonError,
  BackendNetworkError,
  BackendRedirectError,
  BackendTimeoutError,
  backendFetch,
  unwrapEnvelope,
} from "@/lib/api/backend";
import { setSessionCookies } from "@/lib/auth/cookies";
import { parseBackendLogin, sessionFromUser } from "@/lib/auth/server-session";
import { assertBrowserOrigin, SecurityError } from "@/lib/security/csrf";
import { jsonError } from "@/lib/security/http";
import { requestId } from "@/lib/security/request-id";

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(512),
}).strict();

function logUpstream(
  id: string,
  pathname: string,
  status: number | null,
  durationMs: number | null,
  error: unknown = null,
) {
  // Intentionally excludes identifier, password, tokens, cookies and headers.
  console.info("panorama.auth.login.upstream", JSON.stringify({
    requestId: id,
    upstreamPathname: pathname,
    upstreamStatus: status,
    durationMs,
    errorClass: error instanceof Error ? error.constructor.name : null,
  }));
}

function upstreamFailure(status: number, upstreamId: string | null, retryAfter: string | null, id: string, code: string, message: string) {
  const response = jsonError(status, code, message, id);
  response.headers.set("x-request-id", upstreamId ?? id);
  if (retryAfter) response.headers.set("retry-after", retryAfter);
  return response;
}

export async function POST(request: NextRequest) {
  const id = requestId(request);
  try {
    assertBrowserOrigin(request);
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 16_384) return jsonError(413, "LOGIN_REQUEST_TOO_LARGE", "Login request is too large.", id);
    let requestPayload: unknown;
    try {
      requestPayload = await request.json();
    } catch {
      return jsonError(400, "LOGIN_INPUT_INVALID", "Login request must be valid JSON.", id);
    }
    const body = loginSchema.safeParse(requestPayload);
    if (!body.success) {
      return jsonError(400, "LOGIN_INPUT_INVALID", "Identifier and password are required.", id);
    }
    const backend = await backendFetch("/api/v1/auth/login/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": id,
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(body.data),
    });
    logUpstream(id, "/api/v1/auth/login/", backend.status, backend.durationMs);
    if (!backend.ok) {
      return upstreamFailure(
        backend.status,
        backend.upstreamRequestId,
        backend.response.headers.get("retry-after"),
        id,
        "LOGIN_UPSTREAM_REJECTED",
        "Login was rejected by the authentication service.",
      );
    }
    const login = parseBackendLogin(backend.data);
    if (!login) return jsonError(502, "LOGIN_RESPONSE_INVALID", "The authentication service returned an invalid response.", id);

    const me = await backendFetch("/api/v1/auth/me/", {
      headers: { Authorization: `Bearer ${login.access}`, "X-Request-ID": id },
    });
    logUpstream(id, "/api/v1/auth/me/", me.status, me.durationMs);
    if (!me.ok) {
      return upstreamFailure(
        me.status,
        me.upstreamRequestId,
        me.response.headers.get("retry-after"),
        id,
        "SESSION_UPSTREAM_REJECTED",
        "The authentication service could not validate the session.",
      );
    }
    const session = sessionFromUser(unwrapEnvelope(me.data));
    if (!session) return jsonError(403, "DASHBOARD_ACCESS_DENIED", "Dashboard access is not allowed.", id);
    const response = NextResponse.json({ success: true, data: session, message: "Logged in successfully." }, {
      headers: { "x-request-id": id, "cache-control": "no-store" },
    });
    setSessionCookies(response, { access: login.access, refresh: login.refresh });
    return response;
  } catch (error) {
    if (error instanceof SecurityError) return jsonError(error.status, error.code, error.message, id);
    logUpstream(id, "/api/v1/auth/login/", null, null, error);
    if (error instanceof BackendTimeoutError) return jsonError(504, "BACKEND_TIMEOUT", "The authentication service did not respond in time.", id);
    if (error instanceof BackendInvalidJsonError || error instanceof BackendRedirectError) {
      return jsonError(502, "BACKEND_INVALID_RESPONSE", "The authentication service returned an invalid response.", id);
    }
    if (error instanceof BackendNetworkError) return jsonError(502, "BACKEND_GATEWAY_ERROR", "Unable to reach the authentication service.", id);
    return jsonError(500, "LOGIN_GATEWAY_FAILED", "Unable to complete login.", id);
  }
}
