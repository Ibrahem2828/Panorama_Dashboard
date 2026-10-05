import type { ListResult, QueryParams } from "@/lib/api/crud";
import type {
  NeedsUpdatePayload,
  RejectPayload,
  StudentAccountRequestDetail,
  StudentAccountRequestListItem,
  StudentAccountRequestOtpPayload,
} from "@/features/student-account-requests/types";

function unavailable<T>(...argumentsToIgnore: unknown[]): Promise<T> {
  void argumentsToIgnore;
  return Promise.reject(new Error("Student account request operations are not present in the current OpenAPI contract."));
}

export const listStudentAccountRequests = (params?: QueryParams) =>
  unavailable<ListResult<StudentAccountRequestListItem>>(params);

export const getStudentAccountRequest = (id: number | string) =>
  unavailable<StudentAccountRequestDetail>(id);

export const approveStudentAccountRequest = (id: number | string) =>
  unavailable<StudentAccountRequestOtpPayload>(id);

export const rejectStudentAccountRequest = (id: number | string, payload: RejectPayload) =>
  unavailable<StudentAccountRequestDetail>(id, payload);

export const markStudentAccountRequestNeedsUpdate = (id: number | string, payload: NeedsUpdatePayload) =>
  unavailable<StudentAccountRequestDetail>(id, payload);

export const resendStudentOtp = (id: number | string) =>
  unavailable<StudentAccountRequestOtpPayload>(id);

export const createCardPreviewToken = (id: number | string) =>
  unavailable<{ url?: string; token?: string }>(id);
