import { afterEach, describe, expect, it, vi } from "vitest";

import { bffFetch } from "@/lib/api/browser-client";

describe("browser BFF client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes a browser network failure into the safe unavailable state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("socket detail must not reach the UI")));

    await expect(bffFetch("/api/auth/session")).rejects.toMatchObject({
      status: 503,
      code: "BACKEND_NETWORK_UNAVAILABLE",
      message: "The service is temporarily unavailable. Please try again.",
    });
  });
});
