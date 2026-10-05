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
