import { describe, expect, it } from "vitest";

import { messages } from "@/i18n/messages";
import { apiErrorText } from "@/lib/api/error-message";
import { AppApiError } from "@/lib/api/errors";
import { canUnlockLogin } from "@/features/users/user-rules";

const translate = (locale: "en" | "ar") => (key: keyof (typeof messages)["en"], values?: Record<string, string | number>) =>
  Object.entries(values ?? {}).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), messages[locale][key]);

describe("429 RATE_LIMITED message", () => {
  it("states the Retry-After seconds, localized", () => {
    const error = new AppApiError({ status: 429, code: "LOGIN_UPSTREAM_REJECTED", retryAfter: 42 });
    expect(apiErrorText(error, translate("en"))).toBe("Too many attempts. Wait 42 seconds and try again.");
    expect(apiErrorText(error, translate("ar"))).toContain("42");
  });

  it("rounds fractional delays up and falls back to the generic text without Retry-After", () => {
    expect(apiErrorText(new AppApiError({ status: 429, retryAfter: 1.2 }), translate("en"))).toContain("2 seconds");
    expect(apiErrorText(new AppApiError({ status: 429 }), translate("en"))).toBe(messages.en["errors.429"]);
  });

  it("maps a 404 from the unlock endpoint to the localized not-found text", () => {
    expect(apiErrorText(new AppApiError({ status: 404, message: "Not found." }), translate("en"))).toBe(messages.en["errors.404"]);
  });
});

describe("canUnlockLogin", () => {
  it("requires rank over the target and excludes the actor itself", () => {
    expect(canUnlockLogin({ id: 2, role: "admin" }, { id: 9, role: "student" })).toBe(true);
    expect(canUnlockLogin({ id: 2, role: "admin" }, { id: 2, role: "admin" })).toBe(false);
    expect(canUnlockLogin({ id: 2, role: "admin" }, { id: 3, role: "admin" })).toBe(false);
    expect(canUnlockLogin({ id: 1, role: "it_support" }, { id: 5, role: "it_support" })).toBe(true);
  });
});
