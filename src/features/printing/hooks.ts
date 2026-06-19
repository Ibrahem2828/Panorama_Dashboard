"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { addPrintNote, assignPrintOrder, getPrintOrder, listPrintOrders, updatePrintStatus } from "@/features/printing/api";
import type { QueryParams } from "@/lib/api/crud";
import { normalizeApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";

export const usePrintOrders = (params?: QueryParams) => useQuery({ queryKey: queryKeys.printing.list(params), queryFn: () => listPrintOrders(params) });
export const usePrintOrder = (id?: string | number) => useQuery({ queryKey: queryKeys.printing.detail(id), queryFn: () => getPrintOrder(id as string), enabled: Boolean(id) });
export function usePrintMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, type, status, note, assigned_to, internal_notes }: { id: string | number; type: "assign" | "status" | "note"; status?: string; note?: string; assigned_to?: string; internal_notes?: string }) => {
      if (type === "assign") return assignPrintOrder(id, assigned_to);
      if (type === "status") return updatePrintStatus(id, status ?? "under_review", note);
      return addPrintNote(id, internal_notes);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.printing.all }); toast.success("Print order updated."); },
    onError: (error) => {
      const err = normalizeApiError(error);
      toast.error(err.message, { description: err.request_id ? `Request ID: ${err.request_id}` : undefined });
    },
  });
}
