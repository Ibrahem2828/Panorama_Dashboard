import { describe, expect, it } from "vitest";

import { loginErrorText, waitText } from "@/features/auth/login-errors";
import { messages, type MessageKey } from "@/i18n/messages";
import { AppApiError } from "@/lib/api/errors";

function translator(locale: "ar" | "en") {
  return (key: MessageKey, values: Record<string, string | number> = {}) =>
    Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), messages[locale][key] as string);
}
const ar = translator("ar");
const en = translator("en");

const INVALID = "البريد/رقم الهاتف أو كلمة المرور غير صحيحة. إن كان حسابك جديدًا فاستخدم رابط الدعوة أو كلمة المرور المؤقتة المرسلة إلى بريدك.";

describe("login error mapping", () => {
  it("maps the backend's HTTP 400 (forwarded by the BFF as LOGIN_UPSTREAM_REJECTED) to the generic credentials message", () => {
    const error = new AppApiError({ status: 400, code: "LOGIN_UPSTREAM_REJECTED", message: "Login was rejected by the authentication service." });
    expect(loginErrorText(error, ar, "ar")).toBe(INVALID);
    expect(loginErrorText(error, ar, "ar")).not.toContain("غير صالح");
  });

  it("gives wrong credentials, an unverified account and a password-less account the same text (no account enumeration)", () => {
    const texts = [
      new AppApiError({ status: 400, code: "LOGIN_UPSTREAM_REJECTED", errors: { identifier: ["x"] } }),
      new AppApiError({ status: 400, code: "LOGIN_UPSTREAM_REJECTED", errors: { identifier: ["verification required"] } }),
      new AppApiError({ status: 400, code: "LOGIN_INPUT_INVALID" }),
      new AppApiError({ status: 401, code: "LOGIN_UPSTREAM_REJECTED" }),
    ].map((error) => loginErrorText(error, ar, "ar"));
    expect(new Set(texts).size).toBe(1);
  });

  it("429 with Retry-After says how many minutes to wait, rounded up", () => {
    expect(loginErrorText(new AppApiError({ status: 429, retryAfter: 61 }), ar, "ar")).toBe("محاولات كثيرة. حاول بعد دقيقتين.");
    expect(loginErrorText(new AppApiError({ status: 429, retryAfter: 30 }), ar, "ar")).toBe("محاولات كثيرة. حاول بعد دقيقة واحدة.");
    expect(loginErrorText(new AppApiError({ status: 429, retryAfter: 300 }), ar, "ar")).toBe("محاولات كثيرة. حاول بعد ٥ دقائق.");
    expect(loginErrorText(new AppApiError({ status: 429, retryAfter: 900 }), ar, "ar")).toBe("محاولات كثيرة. حاول بعد ١٥ دقيقة.");
  });

  it("429 without Retry-After uses the generic wait text", () => {
    expect(loginErrorText(new AppApiError({ status: 429 }), ar, "ar")).toBe("محاولات كثيرة. حاول بعد قليل.");
  });

  it("network failures and 5xx keep the shared messages", () => {
    const network = new AppApiError({ status: 503, code: "BACKEND_NETWORK_UNAVAILABLE", message: "x" });
    expect(loginErrorText(network, ar, "ar")).toBe(messages.ar["errors.network"]);
    expect(loginErrorText(new AppApiError({ status: 502, code: "BACKEND_GATEWAY_ERROR" }), ar, "ar")).toBe(messages.ar["errors.502"]);
    expect(loginErrorText(new AppApiError({ status: 500 }), ar, "ar")).toBe(messages.ar["errors.500"]);
  });

  it("formats English waits", () => {
    expect(waitText(60, "en", en)).toBe("1 minute");
    expect(waitText(180, "en", en)).toBe("3 minutes");
  });
});
