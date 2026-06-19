import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { unwrapApiResponse } from "@/lib/api/response";
import { getRefreshToken } from "@/lib/auth/token-storage";
import type { ApiResponse } from "@/types/api";
import type { User } from "@/types/auth";
import type { LoginRequest, LoginResponse } from "@/features/auth/types";

export async function login(payload: LoginRequest) {
  const response = await apiClient.post<ApiResponse<LoginResponse>>(endpoints.auth.login, payload);
  return unwrapApiResponse(response.data);
}

export async function getMe() {
  const response = await apiClient.get<ApiResponse<User>>(endpoints.auth.me);
  return unwrapApiResponse(response.data);
}

export async function logout() {
  const refresh = getRefreshToken();
  await apiClient.post(endpoints.auth.logout, refresh ? { refresh } : undefined);
}
