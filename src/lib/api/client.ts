"use client";

import { bffFetch } from "@/lib/api/browser-client";

export interface LegacyApiResponse<T> {
  data: T;
  status: number;
}

export interface LegacyRequestConfig {
  body?: unknown;
  headers?: HeadersInit;
  params?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
}

function withParams(path: string, params?: LegacyRequestConfig["params"]): string {
  if (!params) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}${path.includes("?") ? "&" : "?"}${query}` : path;
}

async function request<T>(method: string, path: string, config: LegacyRequestConfig = {}): Promise<LegacyApiResponse<T>> {
  const target = withParams(path, config.params);
  const response = await bffFetch(target, {
    method,
    headers: config.headers,
    body: config.body,
    signal: config.signal,
  });
  return { data: (await response.json()) as T, status: response.status };
}

// Transitional adapter for un-migrated modules. It is same-origin BFF-only.
export const apiClient = {
  get: <T>(path: string, config?: LegacyRequestConfig) => request<T>("GET", path, config),
  post: <T>(path: string, body?: unknown, config?: LegacyRequestConfig) => request<T>("POST", path, { ...config, body }),
  put: <T>(path: string, body?: unknown, config?: LegacyRequestConfig) => request<T>("PUT", path, { ...config, body }),
  patch: <T>(path: string, body?: unknown, config?: LegacyRequestConfig) => request<T>("PATCH", path, { ...config, body }),
  delete: <T>(path: string, config?: LegacyRequestConfig) => request<T>("DELETE", path, config),
};
