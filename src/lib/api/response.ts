import { AppApiError } from "@/lib/api/errors";
import type { ApiResponse } from "@/types/api";

export function unwrapApiResponse<T>(response: ApiResponse<T>): T {
  if (!response.success) {
    throw new AppApiError({
      message: response.message || "Request failed.",
      errors: response.errors,
      request_id: response.request_id,
    });
  }

  return response.data;
}
