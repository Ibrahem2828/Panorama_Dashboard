import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { serverEnv } from "@/config/env.server";
import { isDocumentedBackendOperation } from "@/lib/api/contract-path";
import { clearSessionCookies, setSessionCookies } from "@/lib/auth/cookies";
import { readTokens, refreshTokensResult, type RefreshTokensResult } from "@/lib/auth/server-session";
import { bffTrustHeaders } from "@/lib/security/bff-trust";
import { assertCsrf, SecurityError } from "@/lib/security/csrf";
import { jsonError } from "@/lib/security/http";
import { requestId } from "@/lib/security/request-id";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const RESPONSE_HEADERS = ["content-type", "content-disposition", "cache-control", "retry-after", "etag", "last-modified", "accept-ranges", "content-range", "x-request-id"];
// 50 MiB lecture limit plus 1 MiB of multipart framing and text fields.
const MAX_BODY_BYTES = 51 * 1024 * 1024;
const MAX_HEADERS_BYTES = 16 * 1024;
const MAX_RESPONSE_BYTES = 100 * 1024 * 1024;

function decodePathSegment(segment: string) {
  let decoded = segment;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      throw new SecurityError("Invalid backend path.", 400, "BACKEND_PATH_INVALID");
    }
  }

  if (
    !decoded ||
    decoded === "." ||
    decoded === ".." ||
    decoded.includes("/") ||
    decoded.includes("\\") ||
    decoded.includes(":") ||
    decoded.includes("%") ||
    /[\r\n\u0000]/u.test(decoded)
  ) {
    throw new SecurityError("Invalid backend path.", 400, "BACKEND_PATH_INVALID");
  }
  return decoded;
}

function backendPath(segments: string[], search: string) {
  if (!segments.length || /[\r\n]/u.test(search)) {
    throw new SecurityError("Invalid backend path.", 400, "BACKEND_PATH_INVALID");
  }
  const joined = segments.map(decodePathSegment).join("/");
  if (!joined.startsWith("api/v1/")) {
    throw new SecurityError("Invalid backend path.", 400, "BACKEND_PATH_INVALID");
  }
  // Next strips the trailing slash from catch-all params, but every backend (Django) route and every
  // OpenAPI path ends with one, so restore it before matching the contract and forwarding.
  return `/${joined.replace(/\/+$/u, "")}/${search}`;
}

function validatedBackendPath(method: string, segments: string[], search: string) {
  const target = backendPath(segments, search);
  const pathname = target.split("?", 1)[0] ?? target;
  if (!isDocumentedBackendOperation(method, pathname)) {
    throw new SecurityError("Backend operation is not documented.", 404, "BACKEND_OPERATION_NOT_ALLOWED");
  }
  return target;
}

function exceedsHeaderLimit(request: NextRequest) {
  let size = 0;
  for (const [name, value] of request.headers) {
    if (/[\r\n\u0000]/u.test(name) || /[\r\n\u0000]/u.test(value)) return true;
    size += Buffer.byteLength(name) + Buffer.byteLength(value) + 4;
  }
  return size > MAX_HEADERS_BYTES;
}

function expiredSession(id: string) {
  const response = jsonError(401, "SESSION_INVALID", "Session is invalid or expired.", id);
  clearSessionCookies(response);
  return response;
}

function refreshFailure(id: string, result: RefreshTokensResult) {
  if ([400, 401, 403].includes(result.status)) return expiredSession(id);
  const status = result.status === 429 ? 429 : result.status >= 500 ? 503 : 502;
  const code = status === 429 ? "SESSION_REFRESH_RATE_LIMITED" : "SESSION_BACKEND_UNAVAILABLE";
  const message = status === 429 ? "Session refresh is temporarily rate limited." : "Unable to refresh the session.";
  const response = jsonError(status, code, message, result.upstreamRequestId ?? id);
  if (result.retryAfter) response.headers.set("retry-after", result.retryAfter);
  return response;
}

function idempotencyKey(request: NextRequest) {
  const supplied = request.headers.get("idempotency-key")?.trim();
  if (!supplied) return crypto.randomUUID();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,255}$/u.test(supplied)) {
    throw new SecurityError("Invalid idempotency key.", 400, "IDEMPOTENCY_KEY_INVALID");
  }
  return supplied;
}

function responseBodyWithinLimit(body: ReadableStream<Uint8Array> | null) {
  if (!body) return null;
  let bytes = 0;
  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        controller.error(new Error("Backend response exceeded the BFF response limit."));
        return;
      }
      controller.enqueue(chunk);
    },
  }));
}

const MAX_PASSTHROUGH_TEXT = 500;
const MAX_PASSTHROUGH_BODY_BYTES = 16 * 1024;

function safeText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, MAX_PASSTHROUGH_TEXT) : undefined;
}

function safeIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

/** Retry-After is only forwarded when it is a plain delay in seconds (never arbitrary upstream header text). */
function safeRetryAfter(value: string | null): string | null {
  return value && /^\d{1,7}$/u.test(value.trim()) ? value.trim() : null;
}

async function readJsonObject(response: Response): Promise<Record<string, unknown> | null> {
  if (!(response.headers.get("content-type") ?? "").toLowerCase().includes("json")) return null;
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_PASSTHROUGH_BODY_BYTES) return null;
  try {
    const text = await response.text();
    if (text.length > MAX_PASSTHROUGH_BODY_BYTES) return null;
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The ONLY upstream 5xx/4xx lifecycle bodies that reach the browser: maintenance (503 MAINTENANCE_MODE) and forced
 * update (426 APP_UPDATE_REQUIRED). Every field is individually allowlisted, type-checked and length-capped.
 * Returns null for anything else so the caller keeps hiding the upstream body.
 */
async function lifecyclePassthrough(backend: Response, fallbackId: string): Promise<NextResponse | null> {
  const isMaintenance = backend.status === 503;
  const isUpdate = backend.status === 426;
  if (!isMaintenance && !isUpdate) return null;
  const body = await readJsonObject(backend.clone());
  if (!body) return null;
  const upstreamId = backend.headers.get("x-request-id") ?? fallbackId;
  const details = body.details && typeof body.details === "object" && !Array.isArray(body.details) ? (body.details as Record<string, unknown>) : {};
  const field = (key: string) => details[key] ?? body[key];

  let payload: Record<string, unknown>;
  if (isMaintenance && body.code === "MAINTENANCE_MODE") {
    payload = {
      success: false,
      data: null,
      code: "MAINTENANCE_MODE",
      message: safeText(body.message) ?? "Service is temporarily unavailable for maintenance.",
      details: {
        title_ar: safeText(field("title_ar")) ?? null,
        title_en: safeText(field("title_en")) ?? null,
        message_ar: safeText(field("message_ar")) ?? null,
        estimated_end_at: safeIsoDate(field("estimated_end_at")),
      },
      id_request: upstreamId,
    };
  } else if (isUpdate && body.code === "APP_UPDATE_REQUIRED") {
    payload = {
      success: false,
      data: null,
      code: "APP_UPDATE_REQUIRED",
      message: safeText(body.message) ?? "A newer version of the application is required.",
      details: { message_ar: safeText(field("message_ar")) ?? null, message_en: safeText(field("message_en")) ?? null },
      id_request: upstreamId,
    };
  } else {
    return null;
  }
  const response = NextResponse.json(payload, { status: backend.status, headers: { "x-request-id": upstreamId, "cache-control": "no-store" } });
  const retryAfter = safeRetryAfter(backend.headers.get("retry-after"));
  if (retryAfter) response.headers.set("retry-after", retryAfter);
  return response;
}

/**
 * Upstream 5xx bodies are never safe to expose to a browser. In particular,
 * a Django/proxy HTML error page can include stack traces, hostnames, or other
 * operational details. Preserve the meaningful HTTP status and request ID,
 * while replacing the body with the dashboard's stable API error envelope.
 */
function normalizedUpstreamFailure(backend: Response, fallbackRequestId: string) {
  const upstreamRequestId = backend.headers.get("x-request-id") ?? fallbackRequestId;
  const retryAfter = backend.headers.get("retry-after");
  const status = backend.status;
  const unavailable = status === 503;
  const timeout = status === 504;
  const response = jsonError(
    status,
    unavailable ? "BACKEND_UNAVAILABLE" : timeout ? "UPSTREAM_TIMEOUT" : "UPSTREAM_INTERNAL_ERROR",
    unavailable
      ? "The service is temporarily unavailable. Please try again."
      : timeout
        ? "The service did not respond in time. Please try again."
        : "An unexpected error occurred while processing the request.",
    upstreamRequestId,
  );
  if (retryAfter) response.headers.set("retry-after", retryAfter);
  return response;
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const id = requestId(request);
  try {
    const method = request.method.toUpperCase();
    if (!SAFE_METHODS.has(method)) assertCsrf(request);
    if (exceedsHeaderLimit(request)) return jsonError(431, "REQUEST_HEADERS_TOO_LARGE", "Request headers are too large.", id);

    const length = Number(request.headers.get("content-length") ?? 0);
    if (!Number.isFinite(length) || length > MAX_BODY_BYTES) return jsonError(413, "REQUEST_TOO_LARGE", "Request body is too large.", id);

    const { path } = await context.params;
    const targetPath = validatedBackendPath(method, path, request.nextUrl.search);
    const rawBody = SAFE_METHODS.has(method) ? undefined : await request.arrayBuffer();
    if (rawBody && rawBody.byteLength > MAX_BODY_BYTES) return jsonError(413, "REQUEST_TOO_LARGE", "Request body is too large.", id);

    const current = readTokens(request);
    let access = current.access;
    let refreshedTokens: { access: string; refresh: string } | undefined;
    let refreshAttempted = false;

    if (!access && current.refresh) {
      refreshAttempted = true;
      const refreshed = await refreshTokensResult(current.refresh);
      if (!refreshed.tokens) return refreshFailure(id, refreshed);
      refreshedTokens = refreshed.tokens;
      access = refreshedTokens?.access;
    }
    if (!access) return expiredSession(id);

    const headers = new Headers();
    headers.set("Accept", request.headers.get("accept") ?? "application/json");
    headers.set("Authorization", `Bearer ${access}`);
    headers.set("X-Request-ID", id);
    headers.set("Accept-Language", request.headers.get("accept-language") ?? "ar,en;q=0.8");
    // The backend throttles per client address; without this every user shares the BFF's address.
    for (const [name, value] of Object.entries(bffTrustHeaders(request.headers))) headers.set(name, value);
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("Content-Type", contentType);
    const range = request.headers.get("range");
    if (range && /^bytes=\d*-\d*$/u.test(range)) headers.set("Range", range);
    if (!SAFE_METHODS.has(method)) {
      headers.set("Idempotency-Key", idempotencyKey(request));
    }

    const run = (token: string) => {
      headers.set("Authorization", `Bearer ${token}`);
      return fetch(`${serverEnv.backendApiBaseUrl}${targetPath}`, {
        method,
        headers,
        body: rawBody,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(serverEnv.requestTimeoutMs),
      });
    };

    let backend = await run(access);
    if (backend.status === 401 && current.refresh && !refreshAttempted) {
      refreshAttempted = true;
      const refreshed = await refreshTokensResult(current.refresh);
      if (!refreshed.tokens) return refreshFailure(id, refreshed);
      refreshedTokens = refreshed.tokens;
      backend = await run(refreshed.tokens.access);
    }
    if (backend.status === 401 && refreshAttempted) return expiredSession(id);

    if (backend.status === 503 || backend.status === 426) {
      const lifecycle = await lifecyclePassthrough(backend, id);
      if (lifecycle) return lifecycle;
    }
    if (backend.status >= 500) return normalizedUpstreamFailure(backend, id);

    const responseLength = Number(backend.headers.get("content-length") ?? 0);
    if (Number.isFinite(responseLength) && responseLength > MAX_RESPONSE_BYTES) {
      return jsonError(502, "BACKEND_RESPONSE_TOO_LARGE", "Backend response is too large.", id);
    }

    const responseHeaders = new Headers();
    for (const name of RESPONSE_HEADERS) {
      const value = backend.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set("x-request-id", backend.headers.get("x-request-id") ?? id);
    if (!responseHeaders.has("cache-control")) responseHeaders.set("cache-control", "no-store, private");

    const response = new NextResponse(responseBodyWithinLimit(backend.body), { status: backend.status, headers: responseHeaders });
    if (refreshedTokens) setSessionCookies(response, refreshedTokens);
    return response;
  } catch (error) {
    if (error instanceof SecurityError) return jsonError(error.status, error.code, error.message, id);
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return jsonError(504, "BACKEND_TIMEOUT", "The backend did not respond in time.", id);
    }
    return jsonError(502, "BACKEND_GATEWAY_ERROR", "Unable to reach the backend service.", id);
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
