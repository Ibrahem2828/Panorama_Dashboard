import { apiClient } from "@/lib/api/client";
import { listItems, type QueryParams } from "@/lib/api/crud";
import { endpoints } from "@/lib/api/endpoints";
import { unwrapApiResponse } from "@/lib/api/response";
import type { DashboardNotification } from "@/features/notifications/types";
import type { ApiResponse } from "@/types/api";

type UnreadCountResponse = number | { count?: number; unread_count?: number };

export const listNotifications = (params?: QueryParams) =>
  listItems<DashboardNotification>(endpoints.notifications.list, params);

export async function getUnreadNotificationCount() {
  const response = await apiClient.get<ApiResponse<UnreadCountResponse>>(endpoints.notifications.unreadCount);
  const data = unwrapApiResponse(response.data);
  if (typeof data === "number") {
    return data;
  }
  return data.unread_count ?? data.count ?? 0;
}

export const markNotificationRead = (id: number | string) =>
  apiClient.post<ApiResponse<DashboardNotification>>(endpoints.notifications.markRead(id), {}).then((response) => unwrapApiResponse(response.data));

export const markAllNotificationsRead = () =>
  apiClient.post<ApiResponse<unknown>>(endpoints.notifications.readAll, {}).then((response) => unwrapApiResponse(response.data));
