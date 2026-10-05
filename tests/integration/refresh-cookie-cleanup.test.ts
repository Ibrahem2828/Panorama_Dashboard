import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/auth/refresh/route";

describe("refresh BFF route", () => {
  it("clears session cookies when refresh cookie is absent", async () => {
    const csrf = "a".repeat(32);
    const request = new NextRequest("https://dashboard.example.test/api/auth/refresh", {
      method: "POST",
      headers: { origin: "https://dashboard.example.test", "sec-fetch-site": "same-origin", cookie: `panorama_csrf=${csrf}`, "x-panorama-csrf": csrf },
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toContain("panorama_access=");
    expect(response.headers.get("set-cookie")).toContain("panorama_refresh=");
  });
});
