/** Pure rules of the account deletion screen (mirrors apps/product/dashboard_governance.py). */

export interface UserBrief { id?: number; name: string; email: string; role?: string }

/** `{id, full_name, email, role}` as the dashboard serializers return it; anything else yields null. */
export function userBrief(value: unknown): UserBrief | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const email = typeof raw.email === "string" ? raw.email : "";
  const name = typeof raw.full_name === "string" ? raw.full_name : typeof raw.name === "string" ? raw.name : "";
  if (!email && !name) return null;
  return { id: typeof raw.id === "number" ? raw.id : undefined, name, email, role: typeof raw.role === "string" ? raw.role : undefined };
}

/** Executing a deletion early is irreversible and only administrators may do it (the backend enforces the same). */
export function canExecuteDeletion(role: unknown): boolean {
  return role === "admin" || role === "it_support";
}

/** Only a pending ("requested") deletion can be cancelled or executed. */
export function isPendingDeletion(row: Record<string, unknown>): boolean {
  return row.status === "requested";
}

/** The typed confirmation must equal the account e-mail (case-insensitive, surrounding spaces ignored). */
export function emailMatches(typed: string, expected: string | undefined): boolean {
  return Boolean(expected) && typed.trim().toLowerCase() === (expected ?? "").trim().toLowerCase();
}

export function deletionPath(id: string | number): string {
  return `/api/v1/dashboard/account-deletions/${encodeURIComponent(String(id))}/`;
}
