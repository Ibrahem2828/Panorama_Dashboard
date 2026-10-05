import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ backendFetch: vi.fn() }));

vi.mock("@/lib/api/backend", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/backend")>()),
  backendFetch: mocks.backendFetch,
}));

import {
  BackendInvalidJsonError,
  BackendNetworkError,
  BackendTimeoutError,
} from "@/lib/api/backend";
import { POST } from "@/app/api/auth/login/route";

function request(body: unknown, headers: HeadersInit = {}) {
  return new NextRequest("https://dashboard.example.test/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://dashboard.example.test",
      "sec-fetch-site": "same-origin",
      "x-request-id": "login-test-request-id",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function upstream(status: number, data: unknown = null, headers: HeadersInit = {}) {
  const response = new Response(data === null ? null : JSON.stringify(data), { status, headers });
  return {
    status,
    ok: status >= 200 && status < 300,
    data,
    response,
    durationMs: 17,
    upstreamRequestId: response.headers.get("x-request-id"),
  };
}

const dashboardUser = {
  id: 7,
  full_name: "Dashboard Tester",
  email: "tester@example.test",
  role: "admin",
  is_active: true,
  effective_capabilities: ["dashboard.access"],
};

describe("login BFF", () => {
  beforeEach(() => mocks.backendFetch.mockReset());

  it("validates the browser payload before reaching the backend", async () => {
    const response = await POST(request({ identifier: "", password: "" }));
    expect(response.status).toBe(400);
    expect(mocks.backendFetch).not.toHaveBeenCalled();
  });

  it("sets HttpOnly cookies and returns a sanitized session on backend 200", async () => {
    mocks.backendFetch
      .mockResolvedValueOnce(upstream(200, { access: "access-token", refresh: "refresh-token" }, { "x-request-id": "login-upstream-id" }))
      .mockResolvedValueOnce(upstream(200, dashboardUser, { "x-request-id": "me-upstream-id" }));

    const response = await POST(request({ identifier: "admin", password: "correct-password" }));
    const payload = await response.json();
    const cookies = response.headers.getSetCookie().join("\n");

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({ authenticated: true, effectiveCapabilities: ["dashboard.access"] });
    expect(JSON.stringify(payload)).not.toMatch(/access-token|refresh-token|\"access\"|\"refresh\"/i);
    expect(cookies).toMatch(/panorama_access=access-token; Path=\/api;.*HttpOnly; SameSite=lax/u);
    expect(cookies).toMatch(/panorama_refresh=refresh-token; Path=\/api;.*HttpOnly; SameSite=lax/u);
    expect(cookies).toContain("panorama_csrf=");
    expect(mocks.backendFetch).toHaveBeenNthCalledWith(1, "/api/v1/auth/login/", expect.objectContaining({ method: "POST" }));
    expect(mocks.backendFetch).toHaveBeenNthCalledWith(2, "/api/v1/auth/me/", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer access-token" }) }));
  });

  for (const status of [400, 401, 403, 429, 503]) {
    it(`preserves backend ${status} without converting it to 500`, async () => {
      mocks.backendFetch.mockResolvedValueOnce(upstream(status, { code: "UPSTREAM" }, { "x-request-id": `upstream-${status}`, "retry-after": status === 429 ? "30" : "" }));
      const response = await POST(request({ identifier: "admin", password: "correct-password" }));
      expect(response.status).toBe(status);
      expect(response.headers.get("x-request-id")).toBe(`upstream-${status}`);
      if (status === 429) expect(response.headers.get("retry-after")).toBe("30");
    });
  }

  it("preserves an actual backend 500 rather than masking it as a BFF exception", async () => {
    mocks.backendFetch.mockResolvedValueOnce(upstream(500, null, { "x-request-id": "upstream-500" }));
    const response = await POST(request({ identifier: "admin", password: "correct-password" }));
    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBe("upstream-500");
  });

  it("returns 502 for an invalid upstream JSON response", async () => {
    mocks.backendFetch.mockRejectedValueOnce(new BackendInvalidJsonError("invalid"));
    expect((await POST(request({ identifier: "admin", password: "correct-password" }))).status).toBe(502);
  });

  it("returns 504 for an upstream timeout", async () => {
    mocks.backendFetch.mockRejectedValueOnce(new BackendTimeoutError("timeout"));
    expect((await POST(request({ identifier: "admin", password: "correct-password" }))).status).toBe(504);
  });

  it("returns 502 for an upstream network failure", async () => {
    mocks.backendFetch.mockRejectedValueOnce(new BackendNetworkError("network"));
    expect((await POST(request({ identifier: "admin", password: "correct-password" }))).status).toBe(502);
  });

  it("fails closed when auth/me has no effective capabilities", async () => {
    mocks.backendFetch
      .mockResolvedValueOnce(upstream(200, { access: "access-token", refresh: "refresh-token" }))
      .mockResolvedValueOnce(upstream(200, { ...dashboardUser, effective_capabilities: undefined }));
    expect((await POST(request({ identifier: "admin", password: "correct-password" }))).status).toBe(403);
  });

  it("fails closed for a non-dashboard role even when it presents capabilities", async () => {
    mocks.backendFetch
      .mockResolvedValueOnce(upstream(200, { access: "access-token", refresh: "refresh-token" }))
      .mockResolvedValueOnce(upstream(200, { ...dashboardUser, role: "student" }));
    expect((await POST(request({ identifier: "student", password: "correct-password" }))).status).toBe(403);
  });
});
