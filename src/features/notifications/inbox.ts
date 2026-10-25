"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, normalizeCollection, unwrap } from "@/lib/api/browser-client";
import type { ApiEnvelope } from "@/types/api";

export type InboxCategory = "enrollment" | "verification" | "reports" | "support" | "printing" | "purchases" | "groups" | "chat" | "general";

export const INBOX_CATEGORIES: InboxCategory[] = ["enrollment", "verification", "reports", "support", "printing", "purchases", "groups", "general"];

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

export function useInboxSummary() {
  return useQuery({
    queryKey: ["inbox-summary"],
    queryFn: async () => unwrap(await apiFetch<ApiEnvelope<InboxSummary>>("/api/v1/notifications/summary/")),
    refetchInterval: 30_000,
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
    refetchInterval: 30_000,
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
    refetchInterval: 30_000,
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
