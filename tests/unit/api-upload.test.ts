/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiUpload, onMaintenance } from "@/lib/api/browser-client";
import { AppApiError } from "@/lib/api/errors";

class FakeXhr {
  static last: FakeXhr;
  method = "";
  url = "";
  headers: Record<string, string> = {};
  responseType = "";
  withCredentials = false;
  status = 0;
  responseText = "";
  sent: unknown = null;
  aborted = false;
  upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  private responseHeaders: Record<string, string> = {};
  constructor() { FakeXhr.last = this; }
  open(method: string, url: string) { this.method = method; this.url = url; }
  setRequestHeader(name: string, value: string) { this.headers[name.toLowerCase()] = value; }
  getResponseHeader(name: string) { return this.responseHeaders[name.toLowerCase()] ?? null; }
  send(body: unknown) { this.sent = body; }
  abort() { this.aborted = true; this.onabort?.(); }
  respond(status: number, body: unknown, headers: Record<string, string> = {}) {
    this.status = status;
    this.responseText = typeof body === "string" ? body : JSON.stringify(body);
    this.responseHeaders = headers;
    this.onload?.();
  }
}

beforeEach(() => {
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
  document.cookie = "panorama_csrf=csrf-token-1; path=/";
});
afterEach(() => {
  vi.unstubAllGlobals();
  onMaintenance(null);
  document.cookie = "panorama_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});

const body = () => { const form = new FormData(); form.set("title", "T"); return form; };

describe("apiUpload (multipart through the BFF with progress)", () => {
  it("posts the FormData to the BFF with the CSRF header and the given idempotency key, and reports progress", async () => {
    const progress = vi.fn();
    const promise = apiUpload("/api/v1/dashboard/lectures/", body(), { idempotencyKey: "key-12345678", onProgress: progress });
    const xhr = FakeXhr.last;
    expect(xhr.method).toBe("POST");
    expect(xhr.url).toBe("/api/backend/api/v1/dashboard/lectures/");
    expect(xhr.headers["x-panorama-csrf"]).toBe("csrf-token-1");
    expect(xhr.headers["idempotency-key"]).toBe("key-12345678");
    // The browser must set the multipart boundary itself.
    expect(xhr.headers["content-type"]).toBeUndefined();
    expect(xhr.sent).toBeInstanceOf(FormData);
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 200 });
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 1, total: 0 });
    xhr.respond(201, { success: true, data: { id: 9 } });
    await expect(promise).resolves.toEqual({ success: true, data: { id: 9 } });
    expect(progress).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenCalledWith(50, 200);
  });

  it("generates an idempotency key when none is given", () => {
    void apiUpload("/api/v1/dashboard/lectures/", body()).catch(() => undefined);
    expect(FakeXhr.last.headers["idempotency-key"]).toMatch(/\S{8,}/u);
  });

  it("maps a failed response through the same error mapping as apiFetch (status, code, field errors, request id, Retry-After)", async () => {
    const promise = apiUpload("/api/v1/dashboard/lectures/", body());
    FakeXhr.last.respond(400, { code: "VALIDATION_ERROR", message: "Validation error", errors: { original_file: ["bad"] } }, { "x-request-id": "req-1" });
    const error = await promise.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AppApiError);
    expect(error).toMatchObject({ status: 400, code: "VALIDATION_ERROR", requestId: "req-1", errors: { original_file: ["bad"] } });

    const limited = apiUpload("/api/v1/dashboard/lectures/", body());
    FakeXhr.last.respond(429, { message: "slow down" }, { "retry-after": "7" });
    await expect(limited).rejects.toMatchObject({ status: 429, retryAfter: 7 });

    const large = apiUpload("/api/v1/dashboard/lectures/", body());
    FakeXhr.last.respond(413, "not json");
    await expect(large).rejects.toMatchObject({ status: 413 });
  });

  it("notifies the maintenance host on a 503 MAINTENANCE_MODE", async () => {
    const handler = vi.fn();
    onMaintenance(handler);
    const promise = apiUpload("/api/v1/dashboard/lectures/", body());
    FakeXhr.last.respond(503, { code: "MAINTENANCE_MODE", message: "down", details: { title_en: "Maintenance" } });
    await expect(promise).rejects.toMatchObject({ status: 503, code: "MAINTENANCE_MODE" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("turns a network failure into the 503 BACKEND_NETWORK_UNAVAILABLE error", async () => {
    const promise = apiUpload("/api/v1/dashboard/lectures/", body());
    FakeXhr.last.onerror?.();
    await expect(promise).rejects.toMatchObject({ status: 503, code: "BACKEND_NETWORK_UNAVAILABLE" });
  });

  it("is cancellable: aborting the signal aborts the request and rejects with AbortError", async () => {
    const controller = new AbortController();
    const promise = apiUpload("/api/v1/dashboard/lectures/", body(), { signal: controller.signal });
    controller.abort();
    expect(FakeXhr.last.aborted).toBe(true);
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    // Already aborted before sending: never opens a request.
    const previous = FakeXhr.last;
    await expect(apiUpload("/api/v1/dashboard/lectures/", body(), { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeXhr.last).toBe(previous);
  });

  it("only accepts normalized /api/v1/ paths", () => {
    expect(() => apiUpload("/etc/passwd", body())).toThrow();
    expect(() => apiUpload("/api/v1/../admin/", body())).toThrow();
  });
});
