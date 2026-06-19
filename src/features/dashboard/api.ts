import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { unwrapApiResponse } from "@/lib/api/response";
import type { ApiResponse } from "@/types/api";
import type { DashboardStats } from "@/features/dashboard/types";

export async function getDashboardStats() {
  const response = await apiClient.get<ApiResponse<DashboardStats>>(endpoints.dashboard.stats);
  return unwrapApiResponse(response.data);
}
