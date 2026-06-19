import { apiClient } from "@/lib/api/client";
import { unwrapApiResponse } from "@/lib/api/response";
import type { ApiResponse, PaginatedResponse } from "@/types/api";

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export type ListResult<T> = PaginatedResponse<T> | T[];

export function listItems<T>(endpoint: string, params?: QueryParams) {
  return apiClient
    .get<ApiResponse<ListResult<T>>>(endpoint, { params: cleanParams(params) })
    .then((response) => unwrapApiResponse(response.data));
}

export function getItem<T>(endpoint: string, id: string | number) {
  return apiClient
    .get<ApiResponse<T>>(`${endpoint}${id}/`)
    .then((response) => unwrapApiResponse(response.data));
}

export function createItem<T, TPayload>(endpoint: string, payload: TPayload) {
  return apiClient
    .post<ApiResponse<T>>(endpoint, payload)
    .then((response) => unwrapApiResponse(response.data));
}

export function updateItem<T, TPayload>(endpoint: string, id: string | number, payload: TPayload) {
  return apiClient
    .patch<ApiResponse<T>>(`${endpoint}${id}/`, payload)
    .then((response) => unwrapApiResponse(response.data));
}

export function deleteItem(endpoint: string, id: string | number) {
  return apiClient
    .delete<ApiResponse<unknown>>(`${endpoint}${id}/`)
    .then((response) => unwrapApiResponse(response.data));
}

export function listData<T>(result: ListResult<T> | undefined) {
  if (!result) {
    return [];
  }

  return Array.isArray(result) ? result : result.results;
}

export function cleanParams(params?: QueryParams) {
  if (!params) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}
