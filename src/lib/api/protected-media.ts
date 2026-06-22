import { env } from "@/config/env";
import { apiClient } from "@/lib/api/client";
import { AppApiError } from "@/lib/api/errors";
import { unwrapApiResponse } from "@/lib/api/response";
import type { PreviewTokenResponse } from "@/lib/api/types";
import type { ApiResponse } from "@/types/api";

export async function requestPreviewToken(endpoint: string, payload?: Record<string, unknown>) {
  const response = await apiClient.post<ApiResponse<PreviewTokenResponse>>(endpoint, payload ?? {});
  return unwrapApiResponse(response.data);
}

export function getProtectedPreviewUrl(tokenResponse: PreviewTokenResponse) {
  assertPreviewTokenIsUsable(tokenResponse);

  const url = tokenResponse.url ?? tokenResponse.preview_url ?? tokenResponse.protected_url;
  if (url) {
    return new URL(url, env.apiBaseUrl).toString();
  }

  if (tokenResponse.token) {
    return new URL(`/api/v1/protected-media/${tokenResponse.token}/`, env.apiBaseUrl).toString();
  }

  throw new AppApiError({ message: "Preview link was not returned by the API." });
}

export async function openProtectedPreview(getPreviewToken: () => Promise<PreviewTokenResponse>) {
  const tokenResponse = await getPreviewToken();
  const url = getProtectedPreviewUrl(tokenResponse);
  window.open(url, "_blank", "noopener,noreferrer");
}

function assertPreviewTokenIsUsable(tokenResponse: PreviewTokenResponse) {
  if (typeof tokenResponse.expires_in === "number" && tokenResponse.expires_in <= 0) {
    throw new AppApiError({ message: "Preview link expired. Request a new preview link." });
  }

  if (tokenResponse.expires_at && new Date(tokenResponse.expires_at).getTime() <= Date.now()) {
    throw new AppApiError({ message: "Preview link expired. Request a new preview link." });
  }
}
