"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { assignTicket, getSupportTicket, listSupportTickets, replyTicket, updateTicketPriority, updateTicketStatus } from "@/features/support/api";
import type { QueryParams } from "@/lib/api/crud";
import { normalizeApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";

export const useSupportTickets = (params?: QueryParams) => useQuery({ queryKey: queryKeys.support.list(params), queryFn: () => listSupportTickets(params) });
export const useSupportTicket = (id?: string | number) => useQuery({ queryKey: queryKeys.support.detail(id), queryFn: () => getSupportTicket(id as string), enabled: Boolean(id) });
export function useSupportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, type, status, priority, assigned_to, message }: { id: number | string; type: "status" | "priority" | "assign" | "reply"; status?: string; priority?: string; assigned_to?: string; message?: string }) => {
      if (type === "status") return updateTicketStatus(id, status);
      if (type === "priority") return updateTicketPriority(id, priority);
      if (type === "assign") return assignTicket(id, assigned_to);
      return replyTicket(id, message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.support.all }); toast.success("Ticket updated."); },
    onError: (error) => {
      const err = normalizeApiError(error);
      toast.error(err.message, { description: err.request_id ? `Request ID: ${err.request_id}` : undefined });
    },
  });
}
