import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { requestPreviewToken } from "@/lib/api/protected-media";
import { listItems, type QueryParams } from "@/lib/api/crud";
import { unwrapApiResponse } from "@/lib/api/response";
import type { ApiResponse } from "@/types/api";
import type { VerificationDecision, VerificationRequest } from "@/features/verification/types";

const base = endpoints.verification.requests;

export const listVerifications = (params?: QueryParams) => listItems<VerificationRequest>(base, params);

export const getVerification = (id: number) =>
  apiClient.get<ApiResponse<VerificationRequest>>(endpoints.verification.detail(id)).then((response) => unwrapApiResponse(response.data));

export const approveVerification = (id: number) =>
  apiClient.post<ApiResponse<VerificationRequest>>(endpoints.verification.approve(id), {}).then((response) => unwrapApiResponse(response.data));

export const rejectVerification = (id: number, payload: VerificationDecision) =>
  apiClient.post<ApiResponse<VerificationRequest>>(endpoints.verification.reject(id), payload).then((response) => unwrapApiResponse(response.data));

export const needsUpdateVerification = (id: number, payload: VerificationDecision) =>
  apiClient.post<ApiResponse<VerificationRequest>>(endpoints.verification.needsUpdate(id), payload).then((response) => unwrapApiResponse(response.data));

export const getVerificationCardPreviewToken = (id: number) =>
  requestPreviewToken(endpoints.verification.cardPreviewToken(id));
