"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, normalizeCollection, unwrap } from "@/lib/api/browser-client";
import type { ApiEnvelope } from "@/types/api";

/* Request/response types of the term endpoints (see the admin-ops API contract). Kept here, not in the generated contract. */

export interface TermSemester { id: number; name: string; order: number }
export interface CurrentTerm {
  semester: TermSemester | null;
  other_semester: TermSemester | null;
  term_started_at: string | null;
  term_label: string;
}
export interface PreviewGroup { group_id: number; name: string; subject: string | null; whatsapp_active: boolean; members_to_remove: number }
export interface EndTermPreview { groups: PreviewGroup[]; total_memberships: number; total_students: number }
export interface EndTermRequest { confirm: true; next_semester: number; label: string; disable_whatsapp_links: boolean }
export interface EndTermResult { rollover_id: number; removed: number; groups: PreviewGroup[] }
export interface RolloverRow {
  id: number;
  label?: string;
  performed_by?: string | { full_name?: string } | null;
  created_at?: string;
  removed?: number;
  total_memberships?: number;
  total_students?: number;
  groups_count?: number;
  undone_at?: string | null;
  is_latest?: boolean;
}
export interface WhatsappMember { full_name: string; phone_number: string }
export interface WhatsappGroup { group_id: number; name: string; members: WhatsappMember[] }
export interface WhatsappList { groups: WhatsappGroup[] }

const TERM_KEY = ["current-term"] as const;
const ADMIN_TERM_KEY = ["admin-current-term"] as const;
const ROLLOVERS_KEY = ["term-rollovers"] as const;

/** The current term, readable by any signed-in user; `enabled` lets callers skip it for people who cannot act on it. */
export function useCurrentTerm(enabled = true) {
  return useQuery({
    queryKey: TERM_KEY,
    enabled,
    staleTime: 60_000,
    queryFn: async () => unwrap(await apiFetch<ApiEnvelope<CurrentTerm>>("/api/v1/academic/current-term/")),
  });
}

export function useAdminTerm() {
  return useQuery({
    queryKey: ADMIN_TERM_KEY,
    queryFn: async () => unwrap(await apiFetch<ApiEnvelope<CurrentTerm>>("/api/v1/dashboard/academic/current-term/")),
  });
}

export function useSemesterOptions() {
  return useQuery({
    queryKey: ["term-semester-options"],
    staleTime: 5 * 60_000,
    queryFn: async () => (await normalizeCollection<TermSemester>(await apiFetch("/api/v1/dashboard/semesters/?page_size=100&ordering=order"))).results,
  });
}

export function useRollovers() {
  return useQuery({
    queryKey: ROLLOVERS_KEY,
    queryFn: async () => (await normalizeCollection<RolloverRow>(await apiFetch("/api/v1/dashboard/academic/end-term/"))).results,
  });
}

export function useSetCurrentTerm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { semester: number; label: string }) =>
      unwrap(await apiFetch<ApiEnvelope<CurrentTerm>>("/api/v1/dashboard/academic/current-term/", { method: "PUT", body })),
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: ADMIN_TERM_KEY }), queryClient.invalidateQueries({ queryKey: TERM_KEY })]),
  });
}

/** Read-only: nothing changes on the server. */
export function useEndTermPreview() {
  return useMutation({
    mutationFn: async () => unwrap(await apiFetch<ApiEnvelope<EndTermPreview>>("/api/v1/dashboard/academic/end-term/preview/", { method: "POST", body: {} })),
  });
}

export function useEndTerm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, idempotencyKey }: { body: EndTermRequest; idempotencyKey: string }) =>
      unwrap(await apiFetch<ApiEnvelope<EndTermResult>>("/api/v1/dashboard/academic/end-term/", { method: "POST", body, idempotencyKey })),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ADMIN_TERM_KEY }),
      queryClient.invalidateQueries({ queryKey: TERM_KEY }),
      queryClient.invalidateQueries({ queryKey: ROLLOVERS_KEY }),
    ]),
  });
}

export function useUndoRollover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rolloverId: number) => apiFetch(`/api/v1/dashboard/academic/end-term/${rolloverId}/undo/`, { method: "POST", body: {} }),
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: ROLLOVERS_KEY }), queryClient.invalidateQueries({ queryKey: ["term-whatsapp-list"] })]),
  });
}

export function useWhatsappList(rolloverId: number | null) {
  return useQuery({
    queryKey: ["term-whatsapp-list", rolloverId],
    enabled: rolloverId !== null,
    queryFn: async () => unwrap(await apiFetch<ApiEnvelope<WhatsappList>>(`/api/v1/dashboard/academic/end-term/${rolloverId}/whatsapp-list/`)),
  });
}

/** Downloads the per-group removal list as the backend's UTF-8 CSV (through the authenticated proxy). */
export async function downloadWhatsappCsv(rolloverId: number) {
  const response = await apiFetch(`/api/v1/dashboard/academic/end-term/${rolloverId}/whatsapp-list/?format=csv`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `whatsapp-removals-${rolloverId}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
