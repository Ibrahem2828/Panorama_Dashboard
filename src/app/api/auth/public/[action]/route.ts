import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { BackendInvalidJsonError, BackendNetworkError, BackendRedirectError, BackendTimeoutError, backendFetch } from "@/lib/api/backend";
import { bffTrustHeaders } from "@/lib/security/bff-trust";
import { assertBrowserOrigin, SecurityError } from "@/lib/security/csrf";
import { jsonError } from "@/lib/security/http";
import { requestId } from "@/lib/security/request-id";

/**
 * Signed-out actions of staff accounts: accept an invitation, look an invitation up, and reset a forgotten password.
 * Only these four actions exist (anything else is a 404), every body is validated, and the browser origin is checked.
 * The backend throttles each of them per client address and per account.
 */
const token = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/u);
const password = z.string().min(1).max(128);

const ACTIONS = {
  "invitation-info": {
    schema: z.object({ token }).strict(),
    build: (body: { token: string }) => ({ path: `/api/v1/auth/invitations/${body.token}/`, method: "GET" as const, payload: null }),
  },
  "invitation-accept": {
    schema: z.object({ token, password, password_confirm: password }).strict(),
    build: (body: unknown) => ({ path: "/api/v1/auth/invitations/accept/", method: "POST" as const, payload: body }),
  },
  "password-reset-request": {
    schema: z.object({ identifier: z.string().trim().email().max(254) }).strict(),
    build: (body: { identifier: string }) => ({ path: "/api/v1/auth/request-password-reset/", method: "POST" as const, payload: { identifier: body.identifier, channel: "email" } }),
  },
  "password-reset-confirm": {
    schema: z.object({ identifier: z.string().trim().email().max(254), code: z.string().regex(/^\d{6}$/u), new_password: password, new_password_confirm: password }).strict(),
    build: (body: { identifier: string; code: string; new_password: string; new_password_confirm: string }) => ({ path: "/api/v1/auth/confirm-password-reset/", method: "POST" as const, payload: { ...body, channel: "email" } }),
  },
} as const;

type ActionName = keyof typeof ACTIONS;

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const id = requestId(request);
  const { action } = await context.params;
  if (!(action in ACTIONS)) return jsonError(404, "NOT_FOUND", "Unknown action.", id);
  const definition = ACTIONS[action as ActionName];
  try {
    assertBrowserOrigin(request);
    if (Number(request.headers.get("content-length") ?? 0) > 8_192) return jsonError(413, "REQUEST_TOO_LARGE", "Request is too large.", id);
    let raw: unknown;
    try { raw = await request.json(); } catch { return jsonError(400, "INPUT_INVALID", "Request must be valid JSON.", id); }
    const parsed = (definition.schema as z.ZodTypeAny).safeParse(raw);
    if (!parsed.success) return jsonError(400, "INPUT_INVALID", "The submitted values are not valid.", id);
    const call = (definition.build as (body: unknown) => { path: string; method: "GET" | "POST"; payload: unknown })(parsed.data);
    const backend = await backendFetch(call.path, {
      method: call.method,
      headers: { "Content-Type": "application/json", "X-Request-ID": id, "Idempotency-Key": crypto.randomUUID(), ...bffTrustHeaders(request.headers) },
      body: call.payload === null ? undefined : JSON.stringify(call.payload),
    });
    const envelope = (backend.data ?? {}) as { success?: boolean; data?: unknown; message?: string; errors?: Record<string, unknown> };
    if (!backend.ok) {
      // Field errors (for example a weak password) are shown to the person typing them; nothing else leaks through.
      // A stable machine code (for example INVITATION_EXPIRED) tells the page which state to show; nothing else is forwarded.
      const upstreamCode = typeof (envelope as { code?: unknown }).code === "string" && /^[A-Z][A-Z0-9_]{2,63}$/u.test((envelope as { code: string }).code) ? (envelope as { code: string }).code : "UPSTREAM_REJECTED";
      const response = jsonError(backend.status, upstreamCode, typeof envelope.message === "string" ? envelope.message : "The request was rejected.", id, envelope.errors ?? null);
      const retry = backend.response.headers.get("retry-after");
      if (retry) response.headers.set("retry-after", retry);
      return response;
    }
    return NextResponse.json({ success: true, data: envelope.data ?? null, message: envelope.message ?? "OK" }, { headers: { "x-request-id": id, "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof SecurityError) return jsonError(error.status, error.code, error.message, id);
    if (error instanceof BackendTimeoutError) return jsonError(504, "BACKEND_TIMEOUT", "The service did not respond in time.", id);
    if (error instanceof BackendInvalidJsonError || error instanceof BackendRedirectError) return jsonError(502, "BACKEND_INVALID_RESPONSE", "The service returned an invalid response.", id);
    if (error instanceof BackendNetworkError) return jsonError(502, "BACKEND_GATEWAY_ERROR", "Unable to reach the service.", id);
    return jsonError(500, "GATEWAY_FAILED", "Unable to complete the request.", id);
  }
}
