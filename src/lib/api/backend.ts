import "server-only";

import { serverEnv } from "@/config/env.server";
import type { ApiEnvelope } from "@/types/api";

export interface BackendResult<T = unknown> {
  status: number;
  ok: boolean;
  data: T | ApiEnvelope<T> | null;
  response: Response;
  durationMs: number;
  upstreamRequestId: string | null;
}

export class BackendTimeoutError extends Error {}
export class BackendNetworkError extends Error {}
export class BackendInvalidJsonError extends Error {}
export class BackendRedirectError extends Error {}

function normalizedPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!normalized.startsWith("/api/v1/") || /[\r\n\\]/u.test(normalized)) {
    throw new Error("Only normalized /api/v1/ backend paths are allowed");
  }
  return normalized;
}

export async function backendFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<BackendResult<T>> {
  const normalized = normalizedPath(path);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), serverEnv.requestTimeoutMs);
  const startedAt = Date.now();
  try {
    let response: Response;
    try {
      response = await fetch(`${serverEnv.backendApiBaseUrl}${normalized}`, {
        ...init,
        cache: "no-store",
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "application/json", ...(init.headers ?? {}) },
      });
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        throw new BackendTimeoutError("Backend request timed out");
      }
      throw new BackendNetworkError("Backend request failed");
    }
    if (response.status >= 300 && response.status < 400) {
      throw new BackendRedirectError("Unexpected backend redirect");
    }
    const contentType = response.headers.get("content-type") ?? "";
    let data: T | ApiEnvelope<T> | null = null;
    if (contentType.includes("application/json")) {
      const text = await response.text();
      if (text.trim()) {
        try {
          data = JSON.parse(text) as T | ApiEnvelope<T>;
        } catch {
          throw new BackendInvalidJsonError("Backend returned invalid JSON");
        }
      }
    }
    return {
      status: response.status,
      ok: response.ok,
      data,
      response,
      durationMs: Date.now() - startedAt,
      upstreamRequestId: response.headers.get("x-request-id"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function unwrapEnvelope<T>(payload: T | ApiEnvelope<T> | null): T | null {
  if (payload && typeof payload === "object" && "success" in payload && "data" in payload) {
    return (payload as ApiEnvelope<T>).data;
  }
  return payload as T | null;
}
