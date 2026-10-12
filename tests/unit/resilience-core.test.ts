import { afterEach, describe, expect, it, vi } from "vitest";

import { nextCheckDelaySeconds, probeService, secondsRemaining } from "@/features/resilience/probe";
import { backoffDelay, retryDelay, shouldRetryQuery } from "@/lib/api/backoff";
import { apiFetch, bffFetch, onMaintenance, onSessionExpired, onUpdateRequired } from "@/lib/api/browser-client";
import { apiErrorText } from "@/lib/api/error-message";
import { AppApiError, idempotencyConflict, isMaintenanceError, isUpdateRequiredError, normalizeApiError, parseMaintenanceInfo } from "@/lib/api/errors";
import { createIdempotencyKeyStore, payloadSignature } from "@/lib/api/idempotency";
import { createQueryClient } from "@/lib/api/query-client";
import { messages } from "@/i18n/messages";

describe("backoffDelay / retryDelay", () => {
  it("grows exponentially, is capped, and stays inside the jitter window", () => {
    const full = (attempt: number) => backoffDelay(attempt, { random: () => 1 });
    const half = (attempt: number) => backoffDelay(attempt, { random: () => 0 });
    expect([0, 1, 2, 3].map(full)).toEqual([1000, 2000, 4000, 8000]);
    expect(full(20)).toBe(30_000);
    expect(half(2)).toBe(2000);
    for (let i = 0; i < 50; i += 1) {
      const delay = backoffDelay(3);
      expect(delay).toBeGreaterThanOrEqual(4000);
      expect(delay).toBeLessThanOrEqual(8000);
    }
  });

  it("honours Retry-After (capped) and otherwise backs off", () => {
    expect(retryDelay(0, new AppApiError({ status: 503, retryAfter: 7 }))).toBe(7000);
    expect(retryDelay(0, new AppApiError({ status: 503, retryAfter: 99_999 }))).toBe(120_000);
    expect(retryDelay(1, new Error("x"), { random: () => 1 })).toBe(2000);
  });
});

describe("shouldRetryQuery", () => {
  it("retries transient failures twice and never client errors, rate limits or lifecycle states", () => {
    expect(shouldRetryQuery(0, new AppApiError({ status: 503, code: "BACKEND_NETWORK_UNAVAILABLE" }))).toBe(true);
    expect(shouldRetryQuery(1, new AppApiError({ status: 502 }))).toBe(true);
    expect(shouldRetryQuery(2, new AppApiError({ status: 502 }))).toBe(false);
    for (const status of [400, 401, 403, 404, 409, 413, 429]) expect(shouldRetryQuery(0, new AppApiError({ status }))).toBe(false);
    expect(shouldRetryQuery(0, new AppApiError({ status: 408 }))).toBe(true);
    expect(shouldRetryQuery(0, new AppApiError({ status: 503, code: "MAINTENANCE_MODE" }))).toBe(false);
    expect(shouldRetryQuery(0, new AppApiError({ status: 426, code: "APP_UPDATE_REQUIRED" }))).toBe(false);
  });

  it("is wired into the query client; mutations are never retried", () => {
    const defaults = createQueryClient().getDefaultOptions();
    expect(defaults.queries?.retry).toBe(shouldRetryQuery);
    expect(defaults.mutations?.retry).toBe(false);
  });
});

describe("idempotency key store", () => {
  it("reuses the key for the same signature, renews it on edit and after reset", () => {
    let n = 0;
    const store = createIdempotencyKeyStore(() => `key-${(n += 1)}`);
    expect(store.peek()).toBeNull();
    expect(store.get("a")).toBe("key-1");
    expect(store.get("a")).toBe("key-1");
    expect(store.get("b")).toBe("key-2");
    store.reset();
    expect(store.get("b")).toBe("key-3");
  });

  it("derives signatures from the payload and file identity, not file content", () => {
    expect(payloadSignature("update", 1, { a: 1 })).toBe(payloadSignature("update", 1, { a: 1 }));
    expect(payloadSignature("update", 1, { a: 1 })).not.toBe(payloadSignature("update", 1, { a: 2 }));
    const form = new FormData();
    form.append("file", new File(["abc"], "a.pdf", { lastModified: 5 }));
    const same = new FormData();
    same.append("file", new File(["xyz"], "a.pdf", { lastModified: 5 }));
    expect(payloadSignature(form)).toBe(payloadSignature(same));
  });
});

describe("lifecycle errors", () => {
  it("parses allowlisted maintenance details, capping text and rejecting bad dates", () => {
    const info = parseMaintenanceInfo({ message: "m", details: { title_ar: "ع", title_en: "t".repeat(900), estimated_end_at: "2030-01-01T10:00:00+00:00" } }, 30);
    expect(info.titleAr).toBe("ع");
    expect(info.titleEn).toHaveLength(500);
    expect(info.messageEn).toBe("m");
    expect(info.estimatedEndAt).toBe("2030-01-01T10:00:00.000Z");
    expect(info.retryAfterSeconds).toBe(30);
    expect(parseMaintenanceInfo({ details: { estimated_end_at: "soon" } }).estimatedEndAt).toBeUndefined();
  });

  it("classifies maintenance, update and idempotency conflicts", () => {
    expect(isMaintenanceError(new AppApiError({ status: 503, code: "MAINTENANCE_MODE" }))).toBe(true);
    expect(isMaintenanceError(new AppApiError({ status: 503, code: "BACKEND_UNAVAILABLE" }))).toBe(false);
    expect(isUpdateRequiredError(new AppApiError({ status: 426, code: "APP_UPDATE_REQUIRED" }))).toBe(true);
    expect(idempotencyConflict(new AppApiError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED" }))).toBe("reused");
    expect(idempotencyConflict(new AppApiError({ status: 409, code: "IDEMPOTENCY_IN_PROGRESS" }))).toBe("in-progress");
    expect(idempotencyConflict(new AppApiError({ status: 409, code: "OTHER" }))).toBeNull();
    expect(idempotencyConflict(new Error("x"))).toBeNull();
  });

  it("shows friendly localized text for idempotency conflicts and the API message otherwise", () => {
    const t = (key: keyof typeof messages.en) => messages.en[key];
    expect(apiErrorText(new AppApiError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "raw" }), t)).toBe(messages.en["idempotency.reused"]);
    expect(apiErrorText(new AppApiError({ status: 409, code: "IDEMPOTENCY_IN_PROGRESS", message: "raw" }), t)).toBe(messages.en["idempotency.inProgress"]);
    expect(apiErrorText(new AppApiError({ status: 400, message: "Bad field" }), t)).toBe("Bad field");
    expect(apiErrorText("nope", t)).toBe(messages.en["common.unknownError"]);
  });

  it("keeps Retry-After when normalizing a plain object", () => {
    expect(normalizeApiError({ status: 429, retryAfter: 12 }).retryAfter).toBe(12);
  });
});

describe("probeService", () => {
  const reply = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });

  it("is up when both the BFF and a regular read answer, including a 401 from a dead session", async () => {
    expect(await probeService(vi.fn().mockResolvedValueOnce(reply(200)).mockResolvedValueOnce(reply(200)))).toBe("up");
    expect(await probeService(vi.fn().mockResolvedValueOnce(reply(200)).mockResolvedValueOnce(reply(401)))).toBe("up");
  });

  it("detects maintenance, other outages and network failure without throwing", async () => {
    expect(await probeService(vi.fn().mockResolvedValueOnce(reply(200)).mockResolvedValueOnce(reply(503, { code: "MAINTENANCE_MODE" })))).toBe("maintenance");
    expect(await probeService(vi.fn().mockResolvedValueOnce(reply(200)).mockResolvedValueOnce(reply(503, { code: "OTHER" })))).toBe("down");
    expect(await probeService(vi.fn().mockResolvedValueOnce(reply(200)).mockResolvedValueOnce(reply(502)))).toBe("down");
    expect(await probeService(vi.fn().mockResolvedValueOnce(reply(503)))).toBe("down");
    expect(await probeService(vi.fn().mockRejectedValue(new TypeError("offline")))).toBe("down");
  });

  it("computes retry delays from Retry-After with growth and clamping", () => {
    expect(nextCheckDelaySeconds(undefined, 0)).toBe(30);
    expect(nextCheckDelaySeconds(1, 0)).toBe(5);
    expect(nextCheckDelaySeconds(60, 1)).toBe(90);
    expect(nextCheckDelaySeconds(10_000, 3)).toBe(300);
    expect(secondsRemaining(null, 0)).toBe(0);
    expect(secondsRemaining(10_500, 10_000)).toBe(1);
    expect(secondsRemaining(1_000, 10_000)).toBe(0);
  });
});

describe("browser client lifecycle and idempotency", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    onMaintenance(null);
    onUpdateRequired(null);
    onSessionExpired(null);
  });

  const failure = (status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

  function stubFetch(response: Response | (() => Response)) {
    const fetchMock = vi.fn(async () => (typeof response === "function" ? response() : response.clone()));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { cookie: "panorama_csrf=csrf-token" });
    return fetchMock;
  }

  it("sends the caller's idempotency key on backend mutations and a fresh one otherwise, never on reads or auth calls", async () => {
    const fetchMock = stubFetch(() => new Response("{}", { status: 200 }));
    await apiFetch("/api/v1/dashboard/announcements/", { method: "POST", body: { a: 1 }, idempotencyKey: "caller-key-12345" });
    await apiFetch("/api/v1/dashboard/announcements/", { method: "POST", body: { a: 1 } });
    await apiFetch("/api/v1/dashboard/announcements/");
    await bffFetch("/api/auth/login", { method: "POST", body: {} });
    const keys = fetchMock.mock.calls.map((call) => new Headers((call[1] as RequestInit).headers).get("idempotency-key"));
    expect(keys[0]).toBe("caller-key-12345");
    expect(keys[1]).toMatch(/^[0-9a-f-]{36}$/u);
    expect(keys[1]).not.toBe(keys[0]);
    expect(keys[2]).toBeNull();
    expect(keys[3]).toBeNull();
    expect(new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get("x-panorama-csrf")).toBe("csrf-token");
    expect((fetchMock.mock.calls[0]?.[1] as Record<string, unknown>).idempotencyKey).toBeUndefined();
  });

  it("announces maintenance and forced updates with their allowlisted details", async () => {
    const maintenance = vi.fn();
    const update = vi.fn();
    onMaintenance(maintenance);
    onUpdateRequired(update);

    stubFetch(failure(503, { code: "MAINTENANCE_MODE", message: "Back soon", details: { title_en: "Maintenance", estimated_end_at: "2030-01-01T10:00:00Z" } }, { "retry-after": "45" }));
    await expect(apiFetch("/api/v1/dashboard/stats/")).rejects.toMatchObject({ status: 503, code: "MAINTENANCE_MODE" });
    expect(maintenance).toHaveBeenCalledTimes(1);
    const info = (maintenance.mock.calls[0]?.[0] as AppApiError).maintenance;
    expect(info).toMatchObject({ titleEn: "Maintenance", messageEn: "Back soon", retryAfterSeconds: 45, estimatedEndAt: "2030-01-01T10:00:00.000Z" });

    stubFetch(failure(426, { code: "APP_UPDATE_REQUIRED", details: { message_en: "Update now" } }));
    await expect(apiFetch("/api/v1/dashboard/stats/")).rejects.toMatchObject({ status: 426 });
    expect(update).toHaveBeenCalledTimes(1);
    expect((update.mock.calls[0]?.[0] as AppApiError).maintenance?.messageEn).toBe("Update now");
  });

  it("treats SESSION_INVALID on a backend call as a global expiry, but not on auth calls, wrong passwords or plain 5xx", async () => {
    const expired = vi.fn();
    onSessionExpired(expired);
    stubFetch(failure(401, { code: "SESSION_INVALID" }));
    await expect(apiFetch("/api/v1/dashboard/stats/")).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledTimes(1);

    await expect(bffFetch("/api/auth/session")).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledTimes(1);

    stubFetch(failure(401, { code: "LOGIN_UPSTREAM_REJECTED" }));
    await expect(apiFetch("/api/v1/dashboard/stats/")).rejects.toMatchObject({ status: 401 });
    stubFetch(failure(503, { code: "BACKEND_UNAVAILABLE" }));
    await expect(apiFetch("/api/v1/dashboard/stats/")).rejects.toMatchObject({ status: 503 });
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it("carries Retry-After and the request id on errors", async () => {
    stubFetch(failure(429, { code: "THROTTLED" }, { "retry-after": "9", "x-request-id": "req-9" }));
    await expect(apiFetch("/api/v1/dashboard/stats/")).rejects.toMatchObject({ status: 429, retryAfter: 9, requestId: "req-9" });
  });
});
