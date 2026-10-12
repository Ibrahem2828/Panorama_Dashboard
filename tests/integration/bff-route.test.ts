import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readTokens: vi.fn(), refreshTokensResult: vi.fn() }));

vi.mock("@/lib/auth/server-session", () => ({
  readTokens: mocks.readTokens,
  refreshTokensResult: mocks.refreshTokensResult,
}));

import { GET, POST } from "@/app/api/backend/[...path]/route";

const fetchMock = vi.fn();
const LIST = "api/v1/dashboard/announcements/";
const CSRF = "c".repeat(32);

function ctx(path: string) {
  return { params: Promise.resolve({ path: path.split("/").filter(Boolean) }) };
}
function authedGet(headers: Record<string, string> = {}) {
  return new NextRequest(`https://dashboard.example.test/api/backend/${LIST}`, {
    headers: { cookie: "panorama_access=acc", ...headers },
  });
}
function authedPost(headers: Record<string, string> = {}) {
  return new NextRequest(`https://dashboard.example.test/api/backend/${LIST}`, {
    method: "POST",
    body: JSON.stringify({ title: "x" }),
    headers: {
      cookie: `panorama_access=acc; panorama_csrf=${CSRF}`,
      "x-panorama-csrf": CSRF,
      origin: "https://dashboard.example.test",
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      ...headers,
    },
  });
}
function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
}
const sentHeaders = (call = 0) => new Headers((fetchMock.mock.calls[call][1] as RequestInit).headers);

beforeEach(() => {
  fetchMock.mockReset();
  mocks.readTokens.mockReset();
  mocks.refreshTokensResult.mockReset();
  mocks.readTokens.mockReturnValue({ access: "acc", refresh: undefined });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const MAINTENANCE_BODY = {
  success: false,
  code: "MAINTENANCE_MODE",
  message: "Back soon",
  details: { title_ar: "صيانة", title_en: "Maintenance", message_ar: "نعود قريباً", estimated_end_at: "2030-01-01T10:00:00+00:00", secret_internal: "db password", traceback: "boom" },
  extra: "ignored",
};

describe("BFF lifecycle passthrough", () => {
  it("passes MAINTENANCE_MODE through with an allowlist and Retry-After", async () => {
    fetchMock.mockResolvedValueOnce(json(MAINTENANCE_BODY, { status: 503, headers: { "retry-after": "120", "x-request-id": "upstream-req-1" } }));
    const response = await GET(authedGet(), ctx(LIST));
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("120");
    expect(response.headers.get("x-request-id")).toBe("upstream-req-1");
    const body = await response.json();
    expect(body.code).toBe("MAINTENANCE_MODE");
    expect(body.message).toBe("Back soon");
    expect(body.details).toEqual({ title_ar: "صيانة", title_en: "Maintenance", message_ar: "نعود قريباً", estimated_end_at: "2030-01-01T10:00:00.000Z" });
    expect(JSON.stringify(body)).not.toContain("secret_internal");
    expect(JSON.stringify(body)).not.toContain("traceback");
  });

  it("drops a non-numeric Retry-After on passthrough", async () => {
    fetchMock.mockResolvedValueOnce(json(MAINTENANCE_BODY, { status: 503, headers: { "retry-after": "Wed, 21 Oct 2030 07:28:00 GMT" } }));
    const response = await GET(authedGet(), ctx(LIST));
    expect(response.headers.get("retry-after")).toBeNull();
    expect((await response.json()).code).toBe("MAINTENANCE_MODE");
  });

  it("passes APP_UPDATE_REQUIRED (426) through with localized messages only", async () => {
    fetchMock.mockResolvedValueOnce(json({ success: false, code: "APP_UPDATE_REQUIRED", message: "Update", details: { message_ar: "حدّث", message_en: "Update now", store_url: "https://evil.example" } }, { status: 426 }));
    const response = await GET(authedGet(), ctx(LIST));
    expect(response.status).toBe(426);
    const body = await response.json();
    expect(body.code).toBe("APP_UPDATE_REQUIRED");
    expect(body.details).toEqual({ message_ar: "حدّث", message_en: "Update now" });
  });

  it("caps over-long text fields", async () => {
    fetchMock.mockResolvedValueOnce(json({ ...MAINTENANCE_BODY, message: "m".repeat(5000) }, { status: 503 }));
    const body = await (await GET(authedGet(), ctx(LIST))).json();
    expect(body.message.length).toBe(500);
  });

  it("still hides every other 5xx body, including a plain 503 and a 500 pretending to be maintenance", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>Traceback: SECRET</html>", { status: 500, headers: { "content-type": "text/html" } }));
    const html = await GET(authedGet(), ctx(LIST));
    const text = await html.text();
    expect(text).not.toContain("SECRET");
    expect(JSON.parse(text).code).toBe("UPSTREAM_INTERNAL_ERROR");

    fetchMock.mockResolvedValueOnce(json({ code: "SOMETHING_ELSE", message: "internal db host down" }, { status: 503, headers: { "retry-after": "7" } }));
    const plain = await GET(authedGet(), ctx(LIST));
    const plainBody = await plain.json();
    expect(plainBody.code).toBe("BACKEND_UNAVAILABLE");
    expect(JSON.stringify(plainBody)).not.toContain("internal db host");

    fetchMock.mockResolvedValueOnce(json(MAINTENANCE_BODY, { status: 500 }));
    expect((await (await GET(authedGet(), ctx(LIST))).json()).code).toBe("UPSTREAM_INTERNAL_ERROR");
  });
});

describe("BFF idempotency", () => {
  it("forwards a client-supplied idempotency key unchanged", async () => {
    fetchMock.mockResolvedValueOnce(json({ success: true, data: {} }, { status: 201 }));
    const response = await POST(authedPost({ "idempotency-key": "stable-key-12345" }), ctx(LIST));
    expect(response.status).toBe(201);
    expect(sentHeaders().get("idempotency-key")).toBe("stable-key-12345");
  });

  it("rejects a malformed key and mints one only when the client sent none", async () => {
    const bad = await POST(authedPost({ "idempotency-key": "bad key!" }), ctx(LIST));
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe("IDEMPOTENCY_KEY_INVALID");
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(json({ success: true }, { status: 201 }));
    await POST(authedPost(), ctx(LIST));
    expect(sentHeaders().get("idempotency-key")).toMatch(/^[0-9a-f-]{36}$/u);
  });

  it("does not send an idempotency key on reads", async () => {
    fetchMock.mockResolvedValueOnce(json({ success: true, data: [] }));
    await GET(authedGet(), ctx(LIST));
    expect(sentHeaders().get("idempotency-key")).toBeNull();
  });
});

describe("BFF client address", () => {
  it("forwards only the trusted (last) X-Forwarded-For hop", async () => {
    fetchMock.mockResolvedValueOnce(json({ success: true, data: [] }));
    await GET(authedGet({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }), ctx(LIST));
    expect(sentHeaders().get("x-forwarded-for")).toBe("203.0.113.9");
  });

  it("sends nothing when the header is missing or invalid", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: [] }));
    await GET(authedGet(), ctx(LIST));
    await GET(authedGet({ "x-forwarded-for": "not-an-ip" }), ctx(LIST));
    expect(sentHeaders(0).get("x-forwarded-for")).toBeNull();
    expect(sentHeaders(1).get("x-forwarded-for")).toBeNull();
  });
});
