import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/auth/logout/route";

describe("logout BFF route", () => {
  it("clears HttpOnly session cookies even without a backend refresh token", async () => {
    const csrf = "a".repeat(32);
    const request = new NextRequest("https://dashboard.example.test/api/auth/logout", {
      method: "POST",
      headers: {
        origin: "https://dashboard.example.test",
        "sec-fetch-site": "same-origin",
        cookie: `panorama_csrf=${csrf}`,
        "x-panorama-csrf": csrf,
      },
    });
    const response = await POST(request);
    const cookies = response.headers.getSetCookie().join("\n");

    expect(response.status).toBe(200);
    expect(cookies).toMatch(/panorama_access=; Path=\/api;.*Max-Age=0/u);
    expect(cookies).toMatch(/panorama_refresh=; Path=\/api;.*Max-Age=0/u);
  });
});
