import { describe, expect, it } from "vitest";

import { parseBackendLogin } from "@/lib/auth/server-session";

describe("parseBackendLogin", () => {
  const user = { id: 1, full_name: "Admin", email: "admin@example.test", role: "admin", effective_capabilities: ["dashboard.access"] };

  it("accepts the real backend response, which also carries the user object", () => {
    const tokens = parseBackendLogin({ success: true, code: "LOGIN_SUCCEEDED", data: { access: "a.b.c", refresh: "d.e.f", user }, request_id: "r" });
    expect(tokens).toEqual({ access: "a.b.c", refresh: "d.e.f" });
  });

  it("accepts a bare token pair (refresh endpoint shape)", () => {
    expect(parseBackendLogin({ data: { access: "a", refresh: "b" } })).toEqual({ access: "a", refresh: "b" });
  });

  it("rejects responses without both tokens", () => {
    expect(parseBackendLogin({ data: { access: "a" } })).toBeNull();
    expect(parseBackendLogin({ data: { access: "", refresh: "b" } })).toBeNull();
    expect(parseBackendLogin(null)).toBeNull();
  });
});
