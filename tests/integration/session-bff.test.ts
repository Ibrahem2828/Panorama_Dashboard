import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadSessionResult: vi.fn() }));

vi.mock("@/lib/auth/server-session", () => ({ loadSessionResult: mocks.loadSessionResult }));

import { GET } from "@/app/api/auth/session/route";

const request = () => new NextRequest("https://dashboard.example.test/api/auth/session");

describe("session BFF state model", () => {
  beforeEach(() => mocks.loadSessionResult.mockReset());

  it("clears only an invalid session and returns 401", async () => {
    mocks.loadSessionResult.mockResolvedValue({ session: null, status: 401 });
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie().join("\n")).toContain("panorama_access=");
  });

  it("preserves an authenticated-but-forbidden state as 403", async () => {
    mocks.loadSessionResult.mockResolvedValue({ session: null, status: 403, upstreamRequestId: "forbidden-request" });
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(response.headers.get("x-request-id")).toBe("forbidden-request");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("reports backend availability separately without clearing browser cookies", async () => {
    mocks.loadSessionResult.mockResolvedValue({ session: null, status: 503, upstreamRequestId: "unavailable-request" });
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("SESSION_BACKEND_UNAVAILABLE");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
