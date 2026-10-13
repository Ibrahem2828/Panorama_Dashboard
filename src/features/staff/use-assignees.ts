"use client";

import { useQuery } from "@tanstack/react-query";

import { useCan, useSession } from "@/features/session";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";
import { CAPABILITIES } from "@/lib/auth/capabilities";

export interface AssigneeOption {
  id: number;
  name: string;
}

interface StaffRecord {
  id: number;
  full_name?: string;
  role?: string;
  is_active?: boolean;
}

/** Roles the backend accepts as assignee, per workflow (see the *AssignSerializer / FeedbackWorkflowSerializer querysets). */
export const ASSIGNEE_ROLES = {
  printing: ["print_staff", "admin", "it_support"],
  support: ["support_staff", "admin", "it_support"],
  feedback: ["support_staff", "admin", "it_support"],
} as const;

/** Merges the per-role pages into one de-duplicated, name-sorted option list of active accounts. */
export function toAssigneeOptions(records: readonly StaffRecord[], roles: readonly string[]): AssigneeOption[] {
  const seen = new Map<number, AssigneeOption>();
  for (const record of records) {
    if (record.is_active === false || !record.role || !roles.includes(record.role)) continue;
    if (!seen.has(record.id)) seen.set(record.id, { id: record.id, name: record.full_name || `#${record.id}` });
  }
  return [...seen.values()].sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Assignee choices for a workflow. Listing accounts needs `users.manage` on the backend (there is no lighter staff
 * endpoint), so staff roles without it (print_staff, support_staff) get a degraded list: only themselves, plus a flag
 * the UI uses to explain the limit instead of showing an empty dropdown after a silent 403.
 */
export function useAssignees(workflow: keyof typeof ASSIGNEE_ROLES) {
  const roles = ASSIGNEE_ROLES[workflow];
  const session = useSession();
  const canListStaff = useCan(CAPABILITIES.users);
  const query = useQuery({
    queryKey: ["assignees", workflow],
    enabled: canListStaff,
    staleTime: 60_000,
    queryFn: async () => {
      const pages = await Promise.all(
        roles.map(async (role) => (await normalizeCollection<StaffRecord>(await apiFetch(`/api/v1/dashboard/users/?page_size=100&is_active=true&role=${role}&ordering=full_name`))).results),
      );
      return toAssigneeOptions(pages.flat(), roles);
    },
  });
  const selfAllowed = (roles as readonly string[]).includes(session.user.role);
  const self: AssigneeOption | null = selfAllowed ? { id: session.user.id, name: session.user.full_name } : null;
  const options = canListStaff ? (query.data ?? []) : self ? [self] : [];
  return { options, limited: !canListStaff, isLoading: canListStaff && query.isPending, isError: canListStaff && query.isError, self };
}
