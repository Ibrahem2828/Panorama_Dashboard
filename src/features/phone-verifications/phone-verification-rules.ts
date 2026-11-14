/**
 * Pure rules of the phone verification queue (`/api/v1/dashboard/phone-verifications/`) and of the student
 * "account devices" panel (`/api/v1/dashboard/users/{id}/account-devices/`). No React, no I/O.
 *
 * The 6-digit code returned by `claim` is a secret: it only ever lives in the state of the code dialog. Nothing in this
 * file stores, logs or caches it.
 */
import type { MessageKey } from "@/i18n/messages";

export const PHONE_VERIFICATION_STATUSES = ["pending_staff", "code_sent", "verified", "expired", "cancelled", "rejected"] as const;
export type PhoneVerificationStatus = (typeof PHONE_VERIFICATION_STATUSES)[number];

/** Minutes a sent code stays valid (backend `PHONE_VERIFICATION_CODE_TTL_MINUTES`). Shown in the WhatsApp message. */
export const CODE_VALIDITY_MINUTES = 10;

/**
 * The ready-to-paste WhatsApp message. EDIT THE WORDING HERE; `{code}` and `{minutes}` are replaced.
 */
export const WHATSAPP_MESSAGE_TEMPLATE = "رمز توثيق رقمك في بانوراما: {code} — صالح لمدة {minutes} دقائق";

export interface PhoneVerificationRow {
  id: number;
  user_id: number;
  user_name: string;
  phone_number: string;
  status: PhoneVerificationStatus | string;
  created_at: string;
  claimed_by_name?: string | null;
  claimed_at?: string | null;
  code_generated?: boolean;
  code_sent_at?: string | null;
  expires_at?: string | null;
  attempts?: number;
  rejection_reason?: string | null;
  verified_at?: string | null;
}

export const STATUS_LABEL_KEYS: Record<PhoneVerificationStatus, MessageKey> = {
  pending_staff: "phoneVerify.status.pending_staff",
  code_sent: "phoneVerify.status.code_sent",
  verified: "phoneVerify.status.verified",
  expired: "phoneVerify.status.expired",
  cancelled: "phoneVerify.status.cancelled",
  rejected: "phoneVerify.status.rejected",
};

export function isKnownStatus(value: unknown): value is PhoneVerificationStatus {
  return (PHONE_VERIFICATION_STATUSES as readonly unknown[]).includes(value);
}

/** Message key for a status; unknown values fall back to the generic "unknown" label. */
export function statusLabelKey(status: unknown): MessageKey {
  return isKnownStatus(status) ? STATUS_LABEL_KEYS[status] : "common.unknownValue";
}

/** Value the shared `StatusPill` understands, so each status gets a sensible colour. */
export function statusTone(status: unknown): string {
  switch (status) {
    case "pending_staff": return "pending";
    case "code_sent": return "processing";
    case "verified": return "approved";
    case "expired": return "draft";
    case "cancelled": return "cancelled";
    case "rejected": return "rejected";
    default: return "unknown";
  }
}

/** Requests staff can still act on (the backend calls these the open statuses). */
export function isOpenStatus(status: unknown): boolean {
  return status === "pending_staff" || status === "code_sent";
}

export type RowAction = "claim" | "reject";

/** Actions offered for a row. A sent code is not re-issued: the student has to wait for it to expire or be rejected. */
export function availableActions(row: Pick<PhoneVerificationRow, "status">): RowAction[] {
  if (row.status === "pending_staff") return ["claim", "reject"];
  if (row.status === "code_sent") return ["reject"];
  return [];
}

/** A row that already has a code (its dialog was closed before sending) issues a NEW code when claimed again. */
export function claimIsReissue(row: Pick<PhoneVerificationRow, "code_generated">): boolean {
  return row.code_generated === true;
}

// ---- phone helpers -----------------------------------------------------------------------------------------------

/** Digits only, in international form without `+` / `00` (a local Syrian `09XXXXXXXX` becomes `9639XXXXXXXX`). */
export function phoneDigits(phone: string | null | undefined): string {
  let digits = String(phone ?? "").replace(/[^\d]/gu, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (/^09\d{8}$/u.test(digits)) digits = `963${digits.slice(1)}`;
  return digits;
}

/** `https://wa.me/<digits>`; null when the number has no usable digits (7 to 15 per E.164). */
export function whatsappChatUrl(phone: string | null | undefined, text?: string): string | null {
  const digits = phoneDigits(phone);
  if (digits.length < 7 || digits.length > 15) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Phone as shown and copied: `+` followed by the international digits (rendered left-to-right by the caller). */
export function displayPhone(phone: string | null | undefined): string {
  const digits = phoneDigits(phone);
  return digits ? `+${digits}` : "";
}

/** The message to paste into WhatsApp. */
export function buildWhatsappMessage(code: string, minutes: number = CODE_VALIDITY_MINUTES, template: string = WHATSAPP_MESSAGE_TEMPLATE): string {
  return template.replaceAll("{code}", code).replaceAll("{minutes}", String(minutes));
}

/** Whether the value looks like the 6-digit code the backend generates. */
export function isSixDigitCode(code: unknown): code is string {
  return typeof code === "string" && /^\d{6}$/u.test(code);
}

// ---- countdown ---------------------------------------------------------------------------------------------------

/** Whole seconds left until `expiresAt` (never negative); null when there is no usable expiry. */
export function remainingSeconds(expiresAt: string | null | undefined, now: number = Date.now()): number | null {
  if (!expiresAt) return null;
  const end = Date.parse(expiresAt);
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - now) / 1000));
}

/** `MM:SS`; minutes are not capped so 125 minutes read `125:00`. */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export type CountdownState = { kind: "none" } | { kind: "running"; seconds: number; text: string; low: boolean } | { kind: "expired" };

/** Countdown of a `code_sent` row. The last minute is flagged `low`. Other statuses have no countdown. */
export function countdownFor(row: Pick<PhoneVerificationRow, "status" | "expires_at">, now: number = Date.now()): CountdownState {
  if (row.status !== "code_sent") return { kind: "none" };
  const seconds = remainingSeconds(row.expires_at, now);
  if (seconds === null) return { kind: "none" };
  if (seconds <= 0) return { kind: "expired" };
  return { kind: "running", seconds, text: formatCountdown(seconds), low: seconds <= 60 };
}

// ---- reject reason -----------------------------------------------------------------------------------------------

export const REJECT_REASON_MAX = 255;

/** Trimmed reason, or null when it is empty (the backend requires one). */
export function normalizeReason(reason: string): string | null {
  const trimmed = reason.trim();
  return trimmed ? trimmed.slice(0, REJECT_REASON_MAX) : null;
}

// ---- backend error codes -----------------------------------------------------------------------------------------

export const PHONE_ERROR_KEYS: Record<string, MessageKey> = {
  PHONE_VERIFICATION_CLAIMED_BY_OTHER: "phoneVerify.error.claimedByOther",
  PHONE_VERIFICATION_NOT_CLAIMED: "phoneVerify.error.notClaimed",
  PHONE_VERIFICATION_NOT_PENDING: "phoneVerify.error.notPending",
  PHONE_VERIFICATION_NOT_OPEN: "phoneVerify.error.notOpen",
  PHONE_NUMBER_IN_USE: "phoneVerify.error.numberInUse",
};

export function phoneErrorKey(code: unknown): MessageKey | null {
  return typeof code === "string" ? (PHONE_ERROR_KEYS[code] ?? null) : null;
}

// ---- account devices ---------------------------------------------------------------------------------------------

export interface AccountDevice {
  id: number;
  name: string;
  platform: string;
  status: "active" | "replaced" | "revoked" | string;
  bound_via: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
  bound_at: string | null;
  replaced_at: string | null;
  counts_toward_limit: boolean;
}

export interface AccountDevicesData {
  user_id: number;
  binding_applies: boolean;
  binding_enforced: boolean;
  switch_limit: number;
  switches_used: number;
  switches_remaining: number;
  window_days: number;
  active_device: AccountDevice | null;
  devices: AccountDevice[];
}

/** Devices that are no longer the active binding (replaced or revoked), newest first as the API sends them. */
export function deviceHistory(data: Pick<AccountDevicesData, "devices" | "active_device">): AccountDevice[] {
  const activeId = data.active_device?.id;
  return data.devices.filter((device) => device.id !== activeId && device.status !== "active");
}

export interface SwitchSummary { used: number; limit: number; remaining: number; exhausted: boolean; ratio: number }

/** Counter of self-service device switches in the current window. */
export function switchSummary(data: Pick<AccountDevicesData, "switches_used" | "switch_limit">): SwitchSummary {
  const limit = Math.max(0, Math.trunc(data.switch_limit || 0));
  const used = Math.max(0, Math.trunc(data.switches_used || 0));
  return { used, limit, remaining: Math.max(0, limit - used), exhausted: limit > 0 && used >= limit, ratio: limit > 0 ? Math.min(1, used / limit) : 0 };
}

export type DeviceNotice = "not_applicable" | "not_enforced" | null;

/** Which notice the panel shows above the data: binding does not apply to staff accounts, or is not switched on. */
export function deviceNotice(data: Pick<AccountDevicesData, "binding_applies" | "binding_enforced">): DeviceNotice {
  if (!data.binding_applies) return "not_applicable";
  if (!data.binding_enforced) return "not_enforced";
  return null;
}

/** The reset only makes sense when there is something to clear: an active binding or counted switches. */
export function canResetDevice(data: Pick<AccountDevicesData, "binding_applies" | "active_device" | "switches_used">): boolean {
  return data.binding_applies && (data.active_device !== null || data.switches_used > 0);
}

export const DEVICE_STATUS_KEYS: Record<string, MessageKey> = {
  active: "accountDevices.status.active",
  replaced: "accountDevices.status.replaced",
  revoked: "accountDevices.status.revoked",
};
export const DEVICE_BOUND_VIA_KEYS: Record<string, MessageKey> = {
  first_login: "accountDevices.boundVia.first_login",
  self_switch: "accountDevices.boundVia.self_switch",
  legacy_session: "accountDevices.boundVia.legacy_session",
};
export function deviceStatusKey(status: unknown): MessageKey { return (typeof status === "string" && DEVICE_STATUS_KEYS[status]) || "common.unknownValue"; }
export function deviceBoundViaKey(via: unknown): MessageKey { return (typeof via === "string" && DEVICE_BOUND_VIA_KEYS[via]) || "common.unknownValue"; }
