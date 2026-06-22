"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  approveStudentAccountRequest,
  getStudentAccountRequest,
  listStudentAccountRequests,
  markStudentAccountRequestNeedsUpdate,
  rejectStudentAccountRequest,
  resendStudentOtp,
} from "@/features/student-account-requests/api";
import { getArabicErrorMessage } from "@/features/student-account-requests/constants";
import type {
  NeedsUpdatePayload,
  RejectPayload,
  StudentAccountRequestDetail,
  StudentAccountRequestOtpPayload,
} from "@/features/student-account-requests/types";
import type { QueryParams } from "@/lib/api/crud";
import { queryKeys } from "@/lib/api/query-keys";

export function useStudentAccountRequests(params?: QueryParams) {
  return useQuery({
    queryKey: queryKeys.studentAccountRequests.list(params),
    queryFn: () => listStudentAccountRequests(params),
  });
}

export function useStudentAccountRequest(id?: number | string) {
  return useQuery({
    queryKey: queryKeys.studentAccountRequests.detail(id),
    queryFn: () => getStudentAccountRequest(id as number | string),
    enabled: Boolean(id),
  });
}

export function useStudentAccountRequestAction() {
  const queryClient = useQueryClient();

  return useMutation<
    StudentAccountRequestDetail | StudentAccountRequestOtpPayload,
    Error,
    {
      id: number | string;
      action: "approve" | "reject" | "needs_update" | "resend_otp";
      payload?: RejectPayload | NeedsUpdatePayload;
    }
  >({
    mutationFn: ({
      id,
      action,
      payload,
    }: {
      id: number | string;
      action: "approve" | "reject" | "needs_update" | "resend_otp";
      payload?: RejectPayload | NeedsUpdatePayload;
    }) => {
      if (action === "approve") {
        return approveStudentAccountRequest(id);
      }
      if (action === "reject") {
        return rejectStudentAccountRequest(id, payload as RejectPayload);
      }
      if (action === "needs_update") {
        return markStudentAccountRequestNeedsUpdate(id, payload as NeedsUpdatePayload);
      }
      return resendStudentOtp(id);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.studentAccountRequests.all });

      if (variables.action === "reject") {
        toast.success("تم رفض طلب الطالب بنجاح.");
        return;
      }

      if (variables.action === "needs_update") {
        toast.success("تم إرسال الطلب كمحتاج إلى تعديل.");
      }
    },
    onError: (error) => {
      toast.error(getArabicErrorMessage(error));
    },
  });
}