"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/api";
import type { QueryParams } from "@/lib/api/crud";
import { AppApiError, normalizeApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";

export function useNotifications(params?: QueryParams) {
  return useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () => listNotifications(params),
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: getUnreadNotificationCount,
  });
}

export function useNotificationActions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ type, id }: { type: "mark-read" | "read-all"; id?: number | string }) => {
      if (type === "read-all") {
        return markAllNotificationsRead();
      }
      if (!id) {
        throw new AppApiError({ message: "Notification ID is required." });
      }
      return markNotificationRead(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      toast.success("Notifications updated.");
    },
    onError: (error) => {
      const err = normalizeApiError(error);
      toast.error(err.message, { description: err.request_id ? `Request ID: ${err.request_id}` : undefined });
    },
  });
}
