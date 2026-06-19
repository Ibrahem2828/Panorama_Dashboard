"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createFileRecord, deleteFileRecord, listFiles, updateFileRecord } from "@/features/files/api";
import type { FileFormValues } from "@/features/files/types";
import type { QueryParams } from "@/lib/api/crud";
import { normalizeApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";

export const useFiles = (params?: QueryParams) => useQuery({ queryKey: queryKeys.files.list(params), queryFn: () => listFiles(params) });

export function useCreateFileRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createFileRecord,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.files.all }); toast.success("File saved."); },
    onError: (error) => {
      const err = normalizeApiError(error);
      toast.error(err.message, { description: err.request_id ? `Request ID: ${err.request_id}` : undefined });
    },
  });
}

export function useUpdateFileRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: FileFormValues }) => updateFileRecord(id, values),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.files.all }); toast.success("File updated."); },
    onError: (error) => {
      const err = normalizeApiError(error);
      toast.error(err.message, { description: err.request_id ? `Request ID: ${err.request_id}` : undefined });
    },
  });
}

export function useDeleteFileRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteFileRecord,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.files.all }); toast.success("File deleted."); },
    onError: (error) => {
      const err = normalizeApiError(error);
      toast.error(err.message, { description: err.request_id ? `Request ID: ${err.request_id}` : undefined });
    },
  });
}
