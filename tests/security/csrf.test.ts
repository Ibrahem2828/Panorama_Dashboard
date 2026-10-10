import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { assertCsrf, SecurityError } from "@/lib/security/csrf";

function request(headers: HeadersInit) {
  return new NextRequest("https://dashboard.example.test/api/backend/api/v1/dashboard/users/", { method: "POST", headers });
}

describe("CSRF BFF guard", () => {
  const token = "a".repeat(32);
  const validHeaders = { origin: "https://dashboard.example.test", "sec-fetch-site": "same-origin", cookie: `panorama_csrf=${token}`, "x-panorama-csrf": token };
  it("accepts an exact same-origin double-submit token", () => expect(() => assertCsrf(request(validHeaders))).not.toThrow());
  it("rejects cross-origin mutation", () => expect(() => assertCsrf(request({ ...validHeaders, origin: "https://evil.example" }))).toThrow(SecurityError));
  it("rejects mismatched CSRF token", () => expect(() => assertCsrf(request({ ...validHeaders, "x-panorama-csrf": "b".repeat(32) }))).toThrow(SecurityError));
});

describe("CSRF BFF guard behind a TLS-terminating proxy", () => {
  const token = "a".repeat(32);
  // The standalone server sees its bind address in request.url; the proxy tells it the public host.
  const proxied = (headers: HeadersInit) =>
    new NextRequest("http://0.0.0.0:3000/api/auth/login", { method: "POST", headers: { host: "dashboard.example.test", "x-forwarded-host": "dashboard.example.test", "x-forwarded-proto": "https", "sec-fetch-site": "same-origin", cookie: `panorama_csrf=${token}`, "x-panorama-csrf": token, ...headers } });
  it("accepts the public origin announced by the proxy", () => expect(() => assertCsrf(proxied({ origin: "https://dashboard.example.test" }))).not.toThrow());
  it("still rejects the container's internal address and foreign origins", () => {
    expect(() => assertCsrf(proxied({ origin: "http://0.0.0.0:3000" }))).toThrow(SecurityError);
    expect(() => assertCsrf(proxied({ origin: "https://evil.example" }))).toThrow(SecurityError);
  });
  it("uses the first value of a comma separated forwarded list", () => expect(() => assertCsrf(proxied({ origin: "https://dashboard.example.test", "x-forwarded-host": "dashboard.example.test, internal", "x-forwarded-proto": "https, http" }))).not.toThrow());
});
