"use client";

import { normalizeApiError } from "@/lib/api/errors";

export type BffRequestInit = Omit<RequestInit, "body"> & { body?: unknown };
export type BffResponse<T> = Response & { readonly __bffData?: T };
type UnwrappedPayload<T> = T extends { data: infer Data } ? Data : T;

function csrfToken(): string | undefined {
  const cookieName = "panorama_csrf=";
  const cookie = document.cookie.split("; ").find((entry) => entry.startsWith(cookieName));
  return cookie ? decodeURIComponent(cookie.slice(cookieName.length)) : undefined;
}
function isMutation(method: string | undefined): boolean { return !["GET", "HEAD", "OPTIONS"].includes((method ?? "GET").toUpperCase()); }
function normalizeBackendPath(path: string): string { if (!path.startsWith("/api/v1/") || /[\\\r\n]/.test(path) || path.includes("..")) throw new Error("Only normalized /api/v1/ paths can use the dashboard BFF proxy"); return path; }
function serializeBody(body: unknown, headers: Headers): BodyInit | undefined {
  if (body === undefined || body === null) return undefined;
  if (typeof body === "string" || body instanceof FormData || body instanceof URLSearchParams || body instanceof Blob || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return body as BodyInit;
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return JSON.stringify(body);
}
export async function bffFetch<T = unknown>(path: string, init: BffRequestInit = {}): Promise<BffResponse<T>> {
  if (!path.startsWith("/api/")) throw new Error("BFF requests must be same-origin API paths");
  const headers = new Headers(init.headers);
  if (isMutation(init.method)) { const token = csrfToken(); if (token) headers.set("x-panorama-csrf", token); }
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, body: serializeBody(init.body, headers), credentials: "same-origin", cache: "no-store" });
  } catch {
    throw normalizeApiError({
      status: 503,
      code: "BACKEND_NETWORK_UNAVAILABLE",
      message: "The service is temporarily unavailable. Please try again.",
    });
  }
  if (!response.ok) {
    let payload: Record<string, unknown>;
    try {
      const body = await response.json();
      payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
    } catch {
      payload = {};
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    throw normalizeApiError({
      ...payload,
      status: response.status,
      requestId: response.headers.get("x-request-id") ?? undefined,
      retryAfter: Number.isFinite(retryAfter) ? retryAfter : undefined,
      message: typeof payload.message === "string" ? payload.message : "Request failed",
    });
  }
  return response as BffResponse<T>;
}
export async function apiFetch<T = unknown>(path: string, init: BffRequestInit = {}): Promise<BffResponse<T>> { return bffFetch<T>(`/api/backend${normalizeBackendPath(path)}`, init); }
export async function unwrap<T>(response: BffResponse<T> | Promise<BffResponse<T>>): Promise<UnwrappedPayload<T>> {
  const settled = await response;
  const payload = (await settled.json()) as unknown;
  return payload && typeof payload === "object" && "data" in payload ? (payload as { data: UnwrappedPayload<T> }).data : payload as UnwrappedPayload<T>;
}
export interface NormalizedCollection<T> { results: T[]; count: number; next: string | null; previous: string | null; }
export function normalizeCollection<T>(payload: unknown): NormalizedCollection<T> {
  if (Array.isArray(payload)) return { results: payload as T[], count: payload.length, next: null, previous: null };
  if (payload && typeof payload === "object") { const source = payload as Record<string, unknown>; const results = Array.isArray(source.results) ? source.results : Array.isArray(source.items) ? source.items : Array.isArray(source.data) ? source.data : []; return { results: results as T[], count: typeof source.count === "number" ? source.count : results.length, next: typeof source.next === "string" ? source.next : null, previous: typeof source.previous === "string" ? source.previous : null }; }
  return { results: [], count: 0, next: null, previous: null };
}
export async function downloadFromBackend(path: string, init: BffRequestInit = {}): Promise<BffResponse<unknown>> { return apiFetch(path, init); }
