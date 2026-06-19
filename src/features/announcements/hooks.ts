"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createAnnouncement, deleteAnnouncement, listAnnouncements, updateAnnouncement } from "@/features/announcements/api";
import type { AnnouncementFormValues } from "@/features/announcements/types";
import type { QueryParams } from "@/lib/api/crud";
import { normalizeApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";

export const useAnnouncements = (params?: QueryParams) => useQuery({ queryKey: queryKeys.announcements.list(params), queryFn: () => listAnnouncements(params) });

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAnnouncement,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all }); toast.success("Announcement created."); },
    onError: (error) => {
      const err = normalizeApiError(error);
      toast.error(err.message, { description: err.request_id ? `Request ID: ${err.request_id}` : undefined });
    },
  });
}
export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: AnnouncementFormValues }) => updateAnnouncement(id, values),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all }); toast.success("Announcement updated."); },
    onError: (error) => {
      const err = normalizeApiError(error);
      toast.error(err.message, { description: err.request_id ? `Request ID: ${err.request_id}` : undefined });
    },
  });
}
export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAnnouncement,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all }); toast.success("Announcement deleted."); },
    onError: (error) => {
      const err = normalizeApiError(error);
      toast.error(err.message, { description: err.request_id ? `Request ID: ${err.request_id}` : undefined });
    },
  });
}
