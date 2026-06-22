import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { listItems, type QueryParams } from "@/lib/api/crud";
import { requestPreviewToken } from "@/lib/api/protected-media";
import { unwrapApiResponse } from "@/lib/api/response";
import type { ApiResponse } from "@/types/api";
import type {
  NeedsUpdatePayload,
  RejectPayload,
  StudentAccountRequestDetail,
  StudentAccountRequestListItem,
  StudentAccountRequestOtpPayload,
} from "@/features/student-account-requests/types";

const base = endpoints.studentAccountRequests;

export const listStudentAccountRequests = (params?: QueryParams) =>
  listItems<StudentAccountRequestListItem>(base.list, params);

export const getStudentAccountRequest = (id: number | string) =>
  apiClient
    .get<ApiResponse<StudentAccountRequestDetail>>(base.detail(id))
    .then((response) => unwrapApiResponse(response.data));

export const approveStudentAccountRequest = (id: number | string) =>
  apiClient
    .post<ApiResponse<StudentAccountRequestOtpPayload>>(base.approve(id), {})
    .then((response) => unwrapApiResponse(response.data));

export const rejectStudentAccountRequest = (id: number | string, payload: RejectPayload) =>
  apiClient
    .post<ApiResponse<StudentAccountRequestDetail>>(base.reject(id), payload)
    .then((response) => unwrapApiResponse(response.data));

export const markStudentAccountRequestNeedsUpdate = (id: number | string, payload: NeedsUpdatePayload) =>
  apiClient
    .post<ApiResponse<StudentAccountRequestDetail>>(base.needsUpdate(id), payload)
    .then((response) => unwrapApiResponse(response.data));

export const resendStudentOtp = (id: number | string) =>
  apiClient
    .post<ApiResponse<StudentAccountRequestOtpPayload>>(base.resendOtp(id), {})
    .then((response) => unwrapApiResponse(response.data));

export const createCardPreviewToken = (id: number | string) =>
  requestPreviewToken(base.cardPreviewToken(id));