import { apiFetch, unwrap } from "@/lib/api/browser-client";
import type { ApiEnvelope } from "@/types/api";

/**
 * Protected preview (same flow as the student web app, minus the app shell):
 *  1. POST the access-ticket endpoint -> `{ preview_url, expires_at, download_allowed }`.
 *  2. Never follow `preview_url` (it is an absolute backend URL). Only its path is used, it must be on the protected
 *     stream allowlist, and it is fetched through the same-origin BFF, which adds the bearer token itself.
 *  3. The bytes become a Blob shown through an object URL, so no backend URL or ticket reaches the DOM.
 * This is a deterrent, not DRM; the server (authorization, short-lived tickets, `download_allowed: false`) is authoritative.
 */

/** Streams a ticket may point at: library files and support-message attachments, always `<prefix>/<token>/`. */
const PREVIEW_PATH = /^\/api\/v1\/(?:protected-files|support\/attachments)\/[A-Za-z0-9-]{8,64}\/$/u;

export class UntrustedPreviewError extends Error {
  constructor() {
    super("The preview address is not a protected file stream.");
    this.name = "UntrustedPreviewError";
  }
}

/** Reduces the backend `preview_url` to its path, or throws when it is not exactly an allowlisted protected stream. */
export function previewPathFromUrl(previewUrl: unknown): string {
  if (typeof previewUrl !== "string" || !previewUrl) throw new UntrustedPreviewError();
  let path: string;
  try {
    path = new URL(previewUrl, "http://placeholder.invalid").pathname;
  } catch {
    throw new UntrustedPreviewError();
  }
  if (!PREVIEW_PATH.test(path)) throw new UntrustedPreviewError();
  return path;
}

export const MAX_PREVIEW_BYTES = 80 * 1024 * 1024;

export type PreviewKind = "pdf" | "image" | "unsupported";

export function previewKind(mime: string | null | undefined, fileType?: string | null): PreviewKind {
  const type = (mime ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("image/")) return "image";
  const hint = (fileType ?? "").toLowerCase();
  if (!type || type === "application/octet-stream") {
    if (hint.includes("pdf")) return "pdf";
    if (/(png|jpe?g|webp)/u.test(hint)) return "image";
  }
  return "unsupported";
}

export interface ProtectedFile { blob: Blob; mimeType: string }

/** Where a protected asset's access ticket is requested (never a stream address). */
export interface ProtectedSource { key: string; ticketPath: string; body?: Record<string, unknown> }

export const protectedSources = {
  libraryFile: (fileId: number | string): ProtectedSource => ({ key: `file:${fileId}`, ticketPath: `/api/v1/files/${encodeURIComponent(String(fileId))}/access-ticket/`, body: { purpose: "view" } }),
  supportAttachment: (messageId: number | string): ProtectedSource => ({ key: `support:${messageId}`, ticketPath: `/api/v1/support/messages/${encodeURIComponent(String(messageId))}/attachment-ticket/` }),
};

export async function fetchProtectedMedia(source: ProtectedSource, signal?: AbortSignal): Promise<ProtectedFile> {
  const ticket = await unwrap(apiFetch<ApiEnvelope<{ preview_url?: string }>>(source.ticketPath, { method: "POST", body: source.body ?? {}, signal }));
  const path = previewPathFromUrl(ticket.preview_url);
  const response = await apiFetch(path, { signal });
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_PREVIEW_BYTES) throw new Error("The file is too large to preview.");
  const blob = await response.blob();
  if (blob.size === 0) throw new Error("The file is empty.");
  if (blob.size > MAX_PREVIEW_BYTES) throw new Error("The file is too large to preview.");
  const served = (response.headers.get("content-type") ?? blob.type ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  return { blob, mimeType: served || "application/octet-stream" };
}
