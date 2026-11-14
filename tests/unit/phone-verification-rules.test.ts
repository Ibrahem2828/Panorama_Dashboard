import { describe, expect, it } from "vitest";

import { messages } from "@/i18n/messages";
import {
  availableActions, buildWhatsappMessage, canResetDevice, claimIsReissue, countdownFor, deviceHistory, deviceNotice, displayPhone, formatCountdown,
  isOpenStatus, isSixDigitCode, normalizeReason, phoneDigits, phoneErrorKey, PHONE_VERIFICATION_STATUSES, remainingSeconds, statusLabelKey, statusTone,
  switchSummary, whatsappChatUrl, WHATSAPP_MESSAGE_TEMPLATE, type AccountDevice, type AccountDevicesData,
} from "@/features/phone-verifications/phone-verification-rules";
import { parseProfileTab } from "@/features/users/user-profile-rules";

const device = (over: Partial<AccountDevice>): AccountDevice => ({
  id: 1, name: "Pixel", platform: "android", status: "active", bound_via: "first_login", first_seen_at: null, last_seen_at: null, bound_at: null, replaced_at: null, counts_toward_limit: false, ...over,
});
const data = (over: Partial<AccountDevicesData> = {}): AccountDevicesData => ({
  user_id: 5, binding_applies: true, binding_enforced: true, switch_limit: 2, switches_used: 0, switches_remaining: 2, window_days: 120, active_device: null, devices: [], ...over,
});

describe("phone verification statuses", () => {
  it("has an Arabic and English label for every status", () => {
    for (const status of PHONE_VERIFICATION_STATUSES) {
      const key = statusLabelKey(status);
      expect(messages.ar[key], key).toBeTruthy();
      expect(messages.en[key], key).toBeTruthy();
    }
    expect(statusLabelKey("code_sent")).toBe("phoneVerify.status.code_sent");
    expect(statusLabelKey("mystery")).toBe("common.unknownValue");
  });
  it("maps statuses to pill tones and open state", () => {
    expect(statusTone("verified")).toBe("approved");
    expect(statusTone("rejected")).toBe("rejected");
    expect(statusTone("x")).toBe("unknown");
    expect(isOpenStatus("pending_staff")).toBe(true);
    expect(isOpenStatus("code_sent")).toBe(true);
    expect(isOpenStatus("verified")).toBe(false);
  });
  it("offers claim and reject only where the backend allows them", () => {
    expect(availableActions({ status: "pending_staff" })).toEqual(["claim", "reject"]);
    expect(availableActions({ status: "code_sent" })).toEqual(["reject"]);
    expect(availableActions({ status: "expired" })).toEqual([]);
    expect(claimIsReissue({ code_generated: true })).toBe(true);
    expect(claimIsReissue({ code_generated: false })).toBe(false);
  });
  it("maps backend error codes to catalog keys", () => {
    expect(phoneErrorKey("PHONE_VERIFICATION_CLAIMED_BY_OTHER")).toBe("phoneVerify.error.claimedByOther");
    expect(phoneErrorKey("PHONE_NUMBER_IN_USE")).toBe("phoneVerify.error.numberInUse");
    expect(phoneErrorKey("OTHER")).toBeNull();
    for (const code of ["PHONE_VERIFICATION_CLAIMED_BY_OTHER", "PHONE_VERIFICATION_NOT_CLAIMED", "PHONE_VERIFICATION_NOT_PENDING", "PHONE_VERIFICATION_NOT_OPEN", "PHONE_NUMBER_IN_USE"]) {
      const key = phoneErrorKey(code)!;
      expect(messages.ar[key]).toBeTruthy();
      expect(messages.en[key]).toBeTruthy();
    }
  });
});

describe("countdown", () => {
  const now = Date.parse("2026-01-01T10:00:00Z");
  it("counts whole seconds and never goes negative", () => {
    expect(remainingSeconds("2026-01-01T10:10:00Z", now)).toBe(600);
    expect(remainingSeconds("2026-01-01T10:00:00.400Z", now)).toBe(1);
    expect(remainingSeconds("2026-01-01T09:00:00Z", now)).toBe(0);
    expect(remainingSeconds(null, now)).toBeNull();
    expect(remainingSeconds("garbage", now)).toBeNull();
  });
  it("formats MM:SS", () => {
    expect(formatCountdown(600)).toBe("10:00");
    expect(formatCountdown(65)).toBe("01:05");
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-4)).toBe("00:00");
    expect(formatCountdown(7500)).toBe("125:00");
  });
  it("only runs for code_sent rows and flags the last minute", () => {
    expect(countdownFor({ status: "pending_staff", expires_at: "2026-01-01T10:10:00Z" }, now)).toEqual({ kind: "none" });
    expect(countdownFor({ status: "code_sent", expires_at: null }, now)).toEqual({ kind: "none" });
    expect(countdownFor({ status: "code_sent", expires_at: "2026-01-01T10:10:00Z" }, now)).toEqual({ kind: "running", seconds: 600, text: "10:00", low: false });
    expect(countdownFor({ status: "code_sent", expires_at: "2026-01-01T10:00:45Z" }, now)).toMatchObject({ kind: "running", text: "00:45", low: true });
    expect(countdownFor({ status: "code_sent", expires_at: "2026-01-01T09:59:59Z" }, now)).toEqual({ kind: "expired" });
  });
});

describe("whatsapp and phone helpers", () => {
  it("normalizes phone numbers to international digits", () => {
    expect(phoneDigits("+963 944-123-456")).toBe("963944123456");
    expect(phoneDigits("00963944123456")).toBe("963944123456");
    expect(phoneDigits("0944123456")).toBe("963944123456");
    expect(phoneDigits(null)).toBe("");
    expect(displayPhone("0944123456")).toBe("+963944123456");
    expect(displayPhone("")).toBe("");
  });
  it("builds the wa.me link only for plausible numbers", () => {
    expect(whatsappChatUrl("+963944123456")).toBe("https://wa.me/963944123456");
    expect(whatsappChatUrl("123")).toBeNull();
    expect(whatsappChatUrl("")).toBeNull();
    expect(whatsappChatUrl("+963944123456", "a b")).toBe("https://wa.me/963944123456?text=a%20b");
  });
  it("fills the editable template", () => {
    expect(WHATSAPP_MESSAGE_TEMPLATE).toContain("{code}");
    expect(buildWhatsappMessage("123456")).toBe("رمز توثيق رقمك في بانوراما: 123456 — صالح لمدة 10 دقائق");
    expect(buildWhatsappMessage("654321", 5, "{code}/{minutes}/{code}")).toBe("654321/5/654321");
  });
  it("validates the code shape and the reject reason", () => {
    expect(isSixDigitCode("012345")).toBe(true);
    expect(isSixDigitCode("12345")).toBe(false);
    expect(isSixDigitCode("12345a")).toBe(false);
    expect(isSixDigitCode(123456)).toBe(false);
    expect(normalizeReason("   ")).toBeNull();
    expect(normalizeReason("  wrong number ")).toBe("wrong number");
    expect(normalizeReason("x".repeat(300))).toHaveLength(255);
  });
});

describe("account devices panel derivations", () => {
  it("lists replaced and revoked devices as history, never the active one", () => {
    const active = device({ id: 3 });
    const history = deviceHistory(data({ active_device: active, devices: [active, device({ id: 2, status: "replaced" }), device({ id: 1, status: "revoked" })] }));
    expect(history.map((item) => item.id)).toEqual([2, 1]);
    expect(deviceHistory(data())).toEqual([]);
  });
  it("summarizes the switch counter", () => {
    expect(switchSummary({ switches_used: 1, switch_limit: 2 })).toEqual({ used: 1, limit: 2, remaining: 1, exhausted: false, ratio: 0.5 });
    expect(switchSummary({ switches_used: 3, switch_limit: 2 })).toMatchObject({ remaining: 0, exhausted: true, ratio: 1 });
    expect(switchSummary({ switches_used: 0, switch_limit: 0 })).toMatchObject({ exhausted: false, ratio: 0 });
  });
  it("chooses the notice for the panel", () => {
    expect(deviceNotice({ binding_applies: true, binding_enforced: true })).toBeNull();
    expect(deviceNotice({ binding_applies: true, binding_enforced: false })).toBe("not_enforced");
    expect(deviceNotice({ binding_applies: false, binding_enforced: true })).toBe("not_applicable");
  });
  it("allows a reset only when there is something to clear", () => {
    expect(canResetDevice({ binding_applies: true, active_device: device({}), switches_used: 0 })).toBe(true);
    expect(canResetDevice({ binding_applies: true, active_device: null, switches_used: 1 })).toBe(true);
    expect(canResetDevice({ binding_applies: true, active_device: null, switches_used: 0 })).toBe(false);
    expect(canResetDevice({ binding_applies: false, active_device: device({}), switches_used: 0 })).toBe(false);
  });
  it("knows the devices profile tab", () => {
    expect(parseProfileTab("devices")).toBe("devices");
  });
});
