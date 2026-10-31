import type { MessageKey } from "@/i18n/messages";

/**
 * Contract of the public invitation endpoints (backend `fix/invitation-lifecycle`).
 * `GET auth/invitations/<token>/` always answers 200 with a `state`; accepting a non-valid token answers 400 with a code.
 */
export type InvitationState = "valid" | "accepted" | "expired" | "revoked" | "unknown";

export interface InvitationInfo {
  state: InvitationState;
  full_name?: string;
  expires_at?: string;
  email_masked?: string;
}

export interface InvitationAccepted { email?: string }

export const INVITATION_ERROR_STATE: Record<string, Exclude<InvitationState, "valid">> = {
  INVITATION_ACCEPTED_ALREADY: "accepted",
  INVITATION_EXPIRED: "expired",
  INVITATION_REVOKED: "revoked",
  INVITATION_INVALID: "unknown",
};

const STATES: readonly InvitationState[] = ["valid", "accepted", "expired", "revoked", "unknown"];

/** Anything the server sends that is not a known state is treated as an unusable link (never as a form). */
export function parseInvitationInfo(data: unknown): InvitationInfo {
  const raw = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const state = STATES.includes(raw.state as InvitationState) ? (raw.state as InvitationState) : "unknown";
  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim().slice(0, 254) : undefined);
  return { state, full_name: text(raw.full_name), expires_at: text(raw.expires_at), email_masked: text(raw.email_masked) };
}

/** The non-valid state a failed accept maps to, or null when the failure is something else (password rules, network). */
export function invitationStateFromError(error: unknown): Exclude<InvitationState, "valid"> | null {
  const code = error && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
  return typeof code === "string" && Object.hasOwn(INVITATION_ERROR_STATE, code) ? INVITATION_ERROR_STATE[code]! : null;
}

const ARABIC = /[؀-ۿ]/u;

/** Field messages for the password (`errors.password` / `errors.password_confirm`), only when the backend wrote them in Arabic. */
export function passwordFieldErrors(error: unknown): string[] {
  const errors = error && typeof error === "object" ? (error as { errors?: Record<string, unknown> }).errors : undefined;
  if (!errors) return [];
  const out: string[] = [];
  for (const field of ["password", "password_confirm", "non_field_errors"]) {
    const value = errors[field];
    const list = Array.isArray(value) ? value : value === undefined ? [] : [value];
    for (const item of list) if (typeof item === "string" && ARABIC.test(item)) out.push(item.slice(0, 300));
  }
  return [...new Set(out)];
}

export const hasPasswordFieldErrors = (error: unknown): boolean => {
  const errors = error && typeof error === "object" ? (error as { errors?: Record<string, unknown> }).errors : undefined;
  return Boolean(errors && ["password", "password_confirm"].some((field) => errors[field] !== undefined));
};

export const NON_VALID_COPY: Record<Exclude<InvitationState, "valid" | "accepted">, { title: MessageKey; body: MessageKey }> = {
  expired: { title: "publicAuth.inviteExpiredTitle", body: "publicAuth.inviteExpired" },
  revoked: { title: "publicAuth.inviteUnusableTitle", body: "publicAuth.inviteInvalid" },
  unknown: { title: "publicAuth.inviteUnusableTitle", body: "publicAuth.inviteInvalid" },
};

/** A plausible e-mail for prefilling the login (the address comes from the URL, so it is validated and never trusted). */
export function safeLoginEmail(value: unknown): string {
  return typeof value === "string" && value.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value) ? value : "";
}
