import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { config, proxy } from "@/proxy";

describe("dashboard page proxy", () => {
  for (const locale of ["ar", "en"]) {
    it(`does not redirect a direct /${locale}/dashboard load when /api cookies are absent from the page request`, () => {
      const request = new NextRequest(`https://dashboard.example.test/${locale}/dashboard`);
      const response = proxy(request);
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    });
  }

  it("emits a fresh CSP nonce and forwards it to the app", () => {
    const first = proxy(new NextRequest("https://dashboard.example.test/ar/dashboard"));
    const second = proxy(new NextRequest("https://dashboard.example.test/ar/dashboard"));
    const nonce = first.headers.get("x-nonce") ?? "";
    expect(nonce.length).toBeGreaterThan(10);
    expect(first.headers.get("content-security-policy")).toContain(`'nonce-${nonce}'`);
    expect(first.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(second.headers.get("x-nonce")).not.toBe(nonce);
  });
});

describe("dashboard proxy matcher", () => {
  const pattern = new RegExp(`^${config.matcher[0]}$`);

  it("excludes /api so request bodies (uploads) are not buffered and truncated at 10 MB", () => {
    for (const path of ["/api/backend/api/v1/files/", "/api/auth/login", "/api/health", "/api/auth/session"]) {
      expect(pattern.test(path)).toBe(false);
    }
  });

  it("still covers pages and excludes static assets", () => {
    for (const path of ["/", "/ar/dashboard", "/en/login", "/apiary/page"]) expect(pattern.test(path)).toBe(true);
    for (const path of ["/_next/static/x.js", "/_next/image", "/favicon.ico", "/brand/logo.png"]) expect(pattern.test(path)).toBe(false);
  });
});
