import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readTokens: vi.fn(),
  refreshTokensResult: vi.fn(),
}));

vi.mock("@/lib/auth/server-session", () => ({
  readTokens: mocks.readTokens,
  refreshTokensResult: mocks.refreshTokensResult,
}));

import { GET } from "@/app/api/backend/[...path]/route";

function request() {
  return new NextRequest("https://dashboard.example.test/api/backend/api/v1/health/ready/", {
    method: "GET",
    headers: { cookie: "panorama_access=access-token", "x-request-id": "dashboard-request-id" },
  });
}

describe("backend BFF upstream failure normalization", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    mocks.readTokens.mockReset();
    mocks.refreshTokensResult.mockReset();
    mocks.readTokens.mockReturnValue({ access: "access-token", refresh: undefined });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("replaces an upstream HTML 500 with a safe JSON error while preserving status and request ID", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("<html><body>Django traceback /srv/app</body></html>", {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8", "x-request-id": "upstream-500" },
    }));

    const response = await GET(request(), { params: Promise.resolve({ path: ["api", "v1", "health", "ready"] }) });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("x-request-id")).toBe("upstream-500");
    expect(payload).toMatchObject({ code: "UPSTREAM_INTERNAL_ERROR", id_request: "upstream-500" });
    expect(JSON.stringify(payload)).not.toContain("Django traceback");
  });

  it("keeps an upstream 503 actionable without clearing the session", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("maintenance", {
      status: 503,
      headers: { "content-type": "text/plain", "retry-after": "30", "x-request-id": "upstream-503" },
    }));

    const response = await GET(request(), { params: Promise.resolve({ path: ["api", "v1", "health", "ready"] }) });
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({ code: "BACKEND_UNAVAILABLE", id_request: "upstream-503" });
    expect(response.headers.get("retry-after")).toBe("30");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
