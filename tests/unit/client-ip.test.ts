import { describe, expect, it } from "vitest";

import { trustedClientIp } from "@/lib/rate-limit";

const h = (value?: string) => new Headers(value === undefined ? {} : { "x-forwarded-for": value });

describe("trusted client address", () => {
  it("uses the last hop appended by the trusted proxy, never a client-supplied one", () => {
    expect(trustedClientIp(h("6.6.6.6, 203.0.113.9"))).toBe("203.0.113.9");
    expect(trustedClientIp(h("203.0.113.9"))).toBe("203.0.113.9");
  });

  it("accepts IPv6 and rejects garbage or missing values", () => {
    expect(trustedClientIp(h("2001:db8::1"))).toBe("2001:db8::1");
    expect(trustedClientIp(h("not-an-ip"))).toBeNull();
    expect(trustedClientIp(h("1.2.3.4, <script>"))).toBeNull();
    expect(trustedClientIp(h())).toBeNull();
  });
});
