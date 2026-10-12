import { describe, expect, it } from "vitest";

import { bffTrustHeaders } from "@/lib/security/bff-trust";

const h = (xff?: string) => new Headers(xff === undefined ? {} : { "x-forwarded-for": xff });

describe("bffTrustHeaders", () => {
  it("sends only X-Forwarded-For when no shared secret is configured", () => {
    expect(bffTrustHeaders(h("203.0.113.9"), undefined)).toEqual({ "X-Forwarded-For": "203.0.113.9" });
    expect(bffTrustHeaders(h("203.0.113.9"), "   ")).toEqual({ "X-Forwarded-For": "203.0.113.9" });
  });

  it("adds the authenticated client address when the secret is set, using the last trusted hop", () => {
    expect(bffTrustHeaders(h("6.6.6.6, 203.0.113.9"), "s3cret")).toEqual({
      "X-Forwarded-For": "203.0.113.9",
      "X-Panorama-BFF-Secret": "s3cret",
      "X-Panorama-Client-IP": "203.0.113.9",
    });
  });

  it("sends nothing (and never the secret) when the client address is unknown or invalid", () => {
    expect(bffTrustHeaders(h(), "s3cret")).toEqual({});
    expect(bffTrustHeaders(h("not-an-ip"), "s3cret")).toEqual({});
  });
});
