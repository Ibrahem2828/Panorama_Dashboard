import type { CrossRule } from "@/features/resources/form-schema";

/**
 * Membership moderation rules mirrored from the backend (`apps/groups/services.py` / `views.py`).
 *
 * The dashboard contract exposes only approve / reject / block and a role update for memberships:
 *  - "remove member" is `reject` on an approved member (status becomes `rejected`; the student may ask to join again),
 *  - "unblock" is `reject` on a blocked member (clears the block; the student may ask to join again),
 *  - there is no hard delete and no direct "unblock" operation.
 * The backend stays authoritative; this only decides which buttons make sense for a status.
 */
export const MEMBERSHIP_STATUSES = ["pending", "approved", "rejected", "blocked", "left"] as const;
export const MEMBERSHIP_ROLES = ["member", "moderator", "group_admin"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];
export type MembershipAction = "approve" | "reject" | "remove" | "block" | "unblock" | "role";

/** Actions that destroy or restrict access and therefore ask for a confirmation. */
export const CONFIRMED_ACTIONS: readonly MembershipAction[] = ["reject", "remove", "block", "unblock", "role"];

export function availableMembershipActions(status: string): MembershipAction[] {
  switch (status) {
    case "pending": return ["approve", "reject"];
    case "approved": return ["role", "remove", "block"];
    case "rejected": return ["approve"];
    case "blocked": return ["unblock"];
    default: return [];
  }
}

export interface MembershipRequest {
  path: string;
  method: "POST" | "PATCH";
  body?: Record<string, unknown>;
}

export function membershipRequest(action: MembershipAction, membershipId: number | string, role?: string): MembershipRequest {
  const base = `/api/v1/dashboard/group-memberships/${encodeURIComponent(String(membershipId))}`;
  switch (action) {
    case "approve": return { path: `${base}/approve/`, method: "POST" };
    case "block": return { path: `${base}/block/`, method: "POST" };
    case "reject":
    case "remove":
    case "unblock": return { path: `${base}/reject/`, method: "POST" };
    case "role":
      if (!role || !(MEMBERSHIP_ROLES as readonly string[]).includes(role)) throw new Error("A valid role is required.");
      return { path: `${base}/role/`, method: "PATCH", body: { role } };
  }
}

/** Endpoint for a group's member list; pending requests have their own endpoint on the backend. */
export function membersListPath(groupId: number | string, tab: "requests" | "members"): string {
  return `/api/v1/dashboard/groups/${encodeURIComponent(String(groupId))}/${tab === "requests" ? "join-requests" : "memberships"}/`;
}

/** Hosts the backend accepts for the group WhatsApp channel (ExternalChannelService.validate_whatsapp_url). */
export const WHATSAPP_HOSTS: readonly string[] = ["wa.me", "www.wa.me", "api.whatsapp.com", "chat.whatsapp.com", "www.whatsapp.com"];

export function isWhatsappUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && WHATSAPP_HOSTS.includes(url.hostname) && value.trim().length <= 2048;
  } catch {
    return false;
  }
}

export const whatsappUrlRule: CrossRule = {
  check(values) {
    const url = values.url;
    if (typeof url === "string" && url && !isWhatsappUrl(url)) return { field: "url", error: "validation.whatsappUrl" };
    return null;
  },
};
