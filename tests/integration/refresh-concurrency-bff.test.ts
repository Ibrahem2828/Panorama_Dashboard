import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ backendFetch: vi.fn() }));

vi.mock("@/lib/api/backend", () => ({ backendFetch: mocks.backendFetch }));

import { GET } from "@/app/api/backend/[...path]/route";

function request() {
  return new NextRequest("https://dashboard.example.test/api/backend/api/v1/dashboard/users/", {
    method: "GET",
    headers: { cookie: "panorama_access=expired; panorama_refresh=old-refresh" },
  });
}

describe("BFF refresh concurrency", () => {
  beforeEach(() => {
    mocks.backendFetch.mockReset();
    mocks.backendFetch.mockResolvedValue({
      status: 200,
      ok: true,
      data: { access: "rotated-access", refresh: "rotated-refresh" },
      upstreamRequestId: "refresh-request",
      response: new Response(null),
    });
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => {
      const authorization = new Headers(init.headers).get("authorization");
      return Promise.resolve(new Response(null, { status: authorization === "Bearer expired" ? 401 : 200 }));
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("coalesces same-process refreshes and retries each original request once", async () => {
    const context = { params: Promise.resolve({ path: ["api", "v1", "dashboard", "users"] }) };
    const [first, second] = await Promise.all([GET(request(), context), GET(request(), context)]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.backendFetch).toHaveBeenCalledTimes(1);
    expect(first.headers.getSetCookie().join("\n")).toContain("panorama_access=rotated-access");
    expect(second.headers.getSetCookie().join("\n")).toContain("panorama_refresh=rotated-refresh");
  });
});
