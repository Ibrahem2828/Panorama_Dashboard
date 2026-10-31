"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { joinRequestNotificationLink } from "@/features/groups/join-requests-rules";
import { livePollInterval } from "@/features/notifications/live";
import { apiFetch, normalizeCollection, unwrap } from "@/lib/api/browser-client";
import type { ApiEnvelope } from "@/types/api";

export type InboxCategory = "enrollment" | "verification" | "reports" | "support" | "printing" | "purchases" | "groups" | "chat" | "student_registration" | "join_request" | "general";

/** Tabs that are always offered (an empty tab is still a valid answer: "nothing here"). */
export const INBOX_CATEGORIES: InboxCategory[] = ["enrollment", "verification", "reports", "support", "printing", "purchases", "groups", "chat", "general"];
/** Newer kinds: their tab appears once the backend has reported at least one notification of that category. */
export const OPTIONAL_INBOX_CATEGORIES: InboxCategory[] = ["student_registration", "join_request"];

/** The tabs to draw: the fixed ones plus any newer category present in the summary, in a stable order. */
export function visibleInboxCategories(byCategory: Record<string, number> | undefined): InboxCategory[] {
  const present = (key: string) => byCategory !== undefined && Object.prototype.hasOwnProperty.call(byCategory, key);
  const optional = OPTIONAL_INBOX_CATEGORIES.filter(present);
  return [...INBOX_CATEGORIES.slice(0, -1), ...optional, "general"];
}

export interface InboxNotification {
  id: number;
  title: string;
  body: string;
  category: InboxCategory | "";
  type: string;
  deep_link: string;
  is_read: boolean;
  created_at: string;
}

export interface InboxSummary { unread: number; by_category: Record<string, number> }

/** Counters behind the quick-access panel and the command palette; a missing key means "not yours to act on". */
export interface QuickAccessCounts {
  enrollment_pending?: number;
  verification_pending?: number;
  chat_reports_open?: number;
  print_orders_new?: number;
  low_stock?: number;
  support_open?: number;
  purchase_reminders_due?: number;
  notifications_unread?: number;
  /** Group join requests waiting for a decision (only sent to holders of `groups.manage`). */
  join_requests_pending?: number;
  /** Students who registered and have not been looked at yet (only sent to holders of `verification.review`). */
  registrations_new?: number;
}

/**
 * Only same-dashboard relative paths are ever followed from a notification: anything else (an absolute URL, a
 * protocol-relative `//host`, a path outside /dashboard) falls back to the inbox.
 */
export function safeDashboardPath(link: string | null | undefined): string {
  const value = (link ?? "").trim();
  if (!/^\/dashboard(\/[A-Za-z0-9_\-./]*)?(\?[A-Za-z0-9_\-=&.%]*)?$/u.test(value) || value.includes("..")) return "/dashboard/inbox";
  return value;
}

/** Where a notification opens: its own `deep_link`, with the legacy join-request target moved to the dedicated screen. */
export function notificationTarget(item: Pick<InboxNotification, "deep_link" | "category">): string {
  return safeDashboardPath(joinRequestNotificationLink(item.deep_link, item.category));
}

export function useInboxSummary() {
  return useQuery({
    queryKey: ["inbox-summary"],
    queryFn: async () => unwrap(await apiFetch<ApiEnvelope<InboxSummary>>("/api/v1/notifications/summary/")),
    refetchInterval: livePollInterval,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
}

export function useQuickAccessCounts() {
  return useQuery({
    queryKey: ["quick-access"],
    queryFn: async () => {
      const data = await unwrap(await apiFetch<ApiEnvelope<{ counts: QuickAccessCounts }>>("/api/v1/dashboard/quick-access/"));
      return data.counts;
    },
    refetchInterval: livePollInterval,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
}

export function useInboxList(category: string | null, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["inbox-list", category, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize), ordering: "-created_at" });
      if (category) params.set("category", category);
      return normalizeCollection<InboxNotification>(await apiFetch(`/api/v1/notifications/?${params}`));
    },
    refetchInterval: livePollInterval,
    refetchIntervalInBackground: true,
  });
}

export function useInboxMutations() {
  const queryClient = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["inbox-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["inbox-list"] }),
      queryClient.invalidateQueries({ queryKey: ["quick-access"] }),
    ]);
  };
  const markRead = useMutation({
    mutationFn: async (id: number) => apiFetch(`/api/v1/notifications/${id}/read/`, { method: "POST" }),
    onSuccess: refresh,
  });
  const markAllRead = useMutation({
    mutationFn: async (category?: string | null) =>
      apiFetch(`/api/v1/notifications/read-all/${category ? `?category=${encodeURIComponent(category)}` : ""}`, { method: "POST" }),
    onSuccess: refresh,
  });
  return { markRead, markAllRead };
}
