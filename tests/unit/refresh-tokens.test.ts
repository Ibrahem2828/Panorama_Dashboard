import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ backendFetch: vi.fn() }));

vi.mock("@/lib/api/backend", () => ({ backendFetch: mocks.backendFetch }));

import { refreshTokens } from "@/lib/auth/server-session";

describe("refresh-token boundary", () => {
  beforeEach(() => mocks.backendFetch.mockReset());

  it("uses the contract refresh path, accepts rotation, and coalesces concurrent refreshes", async () => {
    mocks.backendFetch.mockResolvedValue({
      status: 200,
      ok: true,
      data: { access: "rotated-access", refresh: "rotated-refresh" },
      upstreamRequestId: "refresh-upstream-id",
      response: new Response(null),
    });

    const [first, second] = await Promise.all([refreshTokens("old-refresh"), refreshTokens("old-refresh")]);

    expect(first).toEqual({ access: "rotated-access", refresh: "rotated-refresh" });
    expect(second).toEqual(first);
    expect(mocks.backendFetch).toHaveBeenCalledTimes(1);
    expect(mocks.backendFetch).toHaveBeenCalledWith("/api/v1/auth/token/refresh/", expect.objectContaining({ method: "POST" }));
  });
});
