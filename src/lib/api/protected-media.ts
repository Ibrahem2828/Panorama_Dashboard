"use client";

import { apiFetch, unwrap } from "@/lib/api/browser-client";
import { normalizeApiError } from "@/lib/api/errors";
import type { PreviewTokenResponse } from "@/lib/api/types";

function ensureBffApiPath(path: string): string {
  if (!path.startsWith("/api/v1/") || /[\\\r\n]/.test(path) || path.includes("..")) {
    throw new Error("Only normalized /api/v1/ backend paths are allowed");
  }
  return path;
}

export async function requestPreviewToken(path: string, body?: Record<string, unknown>): Promise<PreviewTokenResponse> {
  return unwrap<PreviewTokenResponse>(apiFetch<PreviewTokenResponse>(ensureBffApiPath(path), { method: "POST", body }));
}

export async function fetchProtectedMedia(path: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(`/api/backend${ensureBffApiPath(path)}`, { credentials: "same-origin", cache: "no-store", signal });
  if (!response.ok) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = { status: response.status, message: "Unable to load protected media" }; }
    throw normalizeApiError(payload);
  }
  return response.blob();
}

function previewPath(ticket: PreviewTokenResponse): string {
  const candidate = ticket.protected_url ?? ticket.preview_url ?? ticket.url;
  if (!candidate || !candidate.startsWith("/api/v1/")) {
    throw new Error("The backend did not issue a valid same-origin preview ticket.");
  }
  return ensureBffApiPath(candidate);
}

export async function openProtectedPreview(getPreviewToken: () => Promise<PreviewTokenResponse>): Promise<void> {
  const blob = await fetchProtectedMedia(previewPath(await getPreviewToken()));
  const objectUrl = URL.createObjectURL(blob);
  const preview = window.open(objectUrl, "_blank", "noopener,noreferrer");
  if (!preview) URL.revokeObjectURL(objectUrl);
  else window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export function protectedMediaObjectUrl(blob: Blob): string { return URL.createObjectURL(blob); }
