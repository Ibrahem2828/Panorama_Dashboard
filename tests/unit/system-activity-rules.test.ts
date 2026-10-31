import { describe, expect, it } from "vitest";

import { FAILED_LOGIN_REASONS, activityFields, failedReasonOf, outcomeOf, reasonLabelKey, reasonTone } from "@/features/system-activity/rules";
import { messages, type MessageKey } from "@/i18n/messages";

const t = (key: MessageKey) => messages.ar[key] as string;

describe("failed-login reason badges", () => {
  it("maps every backend reason to its Arabic label", () => {
    const labels = Object.fromEntries(FAILED_LOGIN_REASONS.map((reason) => [reason, messages.ar[reasonLabelKey(reason)]]));
    expect(labels).toEqual({
      invalid_credentials: "بيانات خاطئة",
      password_not_set: "لم تُقبل الدعوة بعد / لا توجد كلمة مرور",
      inactive_account: "حساب معطّل",
      unverified: "حساب غير موثّق",
      locked: "مقفل مؤقتًا",
    });
  });

  it("has English parity and a safe fallback for codes from a newer backend", () => {
    for (const reason of FAILED_LOGIN_REASONS) expect(messages.en[reasonLabelKey(reason)]).toBeTruthy();
    expect(reasonLabelKey("brand_new_reason")).toBe("sysActivity.reason.unknown");
    expect(reasonLabelKey(undefined)).toBe("sysActivity.reason.unknown");
  });

  it("highlights locked / wrong credentials as destructive and the account-state reasons as warnings", () => {
    expect(reasonTone("locked")).toBe("destructive");
    expect(reasonTone("invalid_credentials")).toBe("destructive");
    expect(reasonTone("unverified")).toBe("warning");
    expect(reasonTone("password_not_set")).toBe("warning");
    expect(reasonTone("zzz")).toBe("outline");
  });

  it("reads the reason only from failed-login rows", () => {
    expect(failedReasonOf({ kind: "login_failed", extra: { reason: "locked" } })).toBe("locked");
    expect(failedReasonOf({ kind: "request", extra: { reason: "locked" } })).toBeUndefined();
  });
});

describe("outcome and filters", () => {
  it("treats 4xx/5xx, failed logins and denials as errors", () => {
    expect(outcomeOf({ kind: "request", status_code: 200 })).toBe("success");
    expect(outcomeOf({ kind: "request", status_code: 404 })).toBe("error");
    expect(outcomeOf({ kind: "login_failed", status_code: null })).toBe("error");
    expect(outcomeOf({ kind: "denied", status_code: 403 })).toBe("error");
    expect(outcomeOf({ kind: "logout", status_code: null })).toBe("success");
  });

  it("builds the primary/advanced fields and keeps a user chosen from the rollup selectable", () => {
    const fields = activityFields({ t, roleLabel: (role) => role, userOptions: [], selectedUser: "42" });
    expect(fields.filter((field) => field.placement === "primary").map((field) => field.key)).toEqual(["user", "kind", "outcome"]);
    expect(fields.filter((field) => field.placement === "advanced").map((field) => field.key)).toEqual(["role", "method", "route", "created"]);
    const user = fields[0];
    expect(user && "options" in user ? user.options : []).toEqual([{ value: "42", label: "#42" }]);
  });
});
