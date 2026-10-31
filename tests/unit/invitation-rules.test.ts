import { describe, expect, it } from "vitest";

import { isInvalidCredentials } from "@/features/auth/login-errors";
import { invitationStateFromError, parseInvitationInfo, passwordFieldErrors, safeLoginEmail } from "@/features/auth/invitation-rules";
import { actionLabel, isResetAction, staffActionErrorText } from "@/features/users/invitation-rules";
import { messages, type MessageKey } from "@/i18n/messages";
import { AppApiError } from "@/lib/api/errors";

const t = (key: MessageKey, values: Record<string, string | number> = {}) =>
  Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), messages.ar[key] as string);

describe("public invitation contract", () => {
  it("maps every accept error code to a state, and nothing else", () => {
    expect(invitationStateFromError(new AppApiError({ status: 400, code: "INVITATION_ACCEPTED_ALREADY" }))).toBe("accepted");
    expect(invitationStateFromError(new AppApiError({ status: 400, code: "INVITATION_EXPIRED" }))).toBe("expired");
    expect(invitationStateFromError(new AppApiError({ status: 400, code: "INVITATION_REVOKED" }))).toBe("revoked");
    expect(invitationStateFromError(new AppApiError({ status: 400, code: "INVITATION_INVALID" }))).toBe("unknown");
    expect(invitationStateFromError(new AppApiError({ status: 400, code: "UPSTREAM_REJECTED" }))).toBeNull();
    expect(invitationStateFromError(new AppApiError({ status: 400, code: "toString" }))).toBeNull();
    expect(invitationStateFromError(null)).toBeNull();
  });

  it("parses the lookup defensively", () => {
    expect(parseInvitationInfo({ state: "valid", full_name: "A", expires_at: "2026-11-01T00:00:00Z" }).state).toBe("valid");
    expect(parseInvitationInfo({ state: "accepted", email_masked: "a***@x.com" }).email_masked).toBe("a***@x.com");
    expect(parseInvitationInfo({ state: "bogus" }).state).toBe("unknown");
    expect(parseInvitationInfo(null).state).toBe("unknown");
    expect(parseInvitationInfo({}).state).toBe("unknown");
  });

  it("keeps only Arabic password messages from errors.password", () => {
    const error = new AppApiError({ status: 400, errors: { password: ["كلمة المرور شائعة.", "too short"] } });
    expect(passwordFieldErrors(error)).toEqual(["كلمة المرور شائعة."]);
  });

  it("only accepts a plausible e-mail for the login prefill", () => {
    expect(safeLoginEmail("a@b.co")).toBe("a@b.co");
    expect(safeLoginEmail("javascript:alert(1)")).toBe("");
    expect(safeLoginEmail("a b@c.d")).toBe("");
    expect(safeLoginEmail(undefined)).toBe("");
  });
});

describe("staff onboarding helpers", () => {
  const row = { action: "user_invitation_accepted" };
  const enumLabel = () => "غير معروف";

  it("renders the server action_label when present", () => {
    expect(actionLabel({ ...row, action_label: "قبول دعوة" }, t, enumLabel)).toBe("قبول دعوة");
  });

  it("falls back to a local Arabic name so the invitation actions are never unknown", () => {
    for (const action of ["user_invited", "user_invitation_accepted", "user_invitation_revoked", "user_sessions_ended"]) {
      const label = actionLabel({ action, action_label: null }, t, enumLabel);
      expect(label).not.toBe("غير معروف");
      expect(label.length).toBeGreaterThan(3);
    }
    expect(actionLabel({ action: "something_else" }, t, enumLabel)).toBe("غير معروف");
  });

  it("uses the reset action only for accepted invitations", () => {
    expect(isResetAction({ state: "accepted" })).toBe(true);
    for (const state of ["pending", "expired", "revoked", "none"] as const) expect(isResetAction({ state })).toBe(false);
    expect(isResetAction(undefined)).toBe(false);
  });

  it("surfaces the server's Arabic message, then known codes, and never the generic failure for API errors", () => {
    expect(staffActionErrorText(new AppApiError({ status: 400, code: "X", message: "الحساب مقفل مؤقتًا." }), t)).toBe("الحساب مقفل مؤقتًا.");
    expect(staffActionErrorText(new AppApiError({ status: 400, code: "USER_INACTIVE", message: "inactive" }), t)).toBe(messages.ar["staff.error.USER_INACTIVE"]);
    expect(staffActionErrorText(new AppApiError({ status: 403, code: "PERMISSION_DENIED", message: "Permission denied" }), t)).toBe(messages.ar["staff.error.PERMISSION_DENIED"]);
    expect(staffActionErrorText(new AppApiError({ status: 400, code: "NOPE", message: "bad" }), t)).not.toBe(messages.ar["staff.actionFailed"]);
  });
});

describe("login hint", () => {
  it("applies to the generic credential failures only", () => {
    expect(isInvalidCredentials(new AppApiError({ status: 400 }))).toBe(true);
    expect(isInvalidCredentials(new AppApiError({ status: 401 }))).toBe(true);
    expect(isInvalidCredentials(new AppApiError({ status: 429 }))).toBe(false);
    expect(isInvalidCredentials(new Error("x"))).toBe(false);
  });

  it("has the agreed Arabic copy", () => {
    expect(messages.ar["auth.invalidCredentialsHint"]).toBe("أنشأ لك المسؤول حسابًا حديثًا؟ إن حدّدت كلمة مرورك سابقًا فاستخدمها، وإلا اختر «نسيت كلمة المرور؟».");
  });
});
