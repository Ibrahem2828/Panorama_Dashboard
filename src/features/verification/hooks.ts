"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { approveVerification, getVerification, listVerifications, needsUpdateVerification, rejectVerification } from "@/features/verification/api";
import type { VerificationDecision } from "@/features/verification/types";
import type { QueryParams } from "@/lib/api/crud";
import { normalizeApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";

export function useVerifications(params?: QueryParams) {
  return useQuery({
    queryKey: queryKeys.verification.list(params),
    queryFn: () => listVerifications(params),
  });
}

export function useVerification(id?: number | string) {
  return useQuery({
    queryKey: queryKeys.verification.detail(id),
    queryFn: () => getVerification(id as number),
    enabled: Boolean(id),
  });
}

export function useVerificationAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, payload }: { id: number; action: "approve" | "reject" | "needs_update"; payload?: VerificationDecision }) => {
      if (action === "approve") return approveVerification(id);
      if (action === "reject") return rejectVerification(id, payload ?? {});
      return needsUpdateVerification(id, payload ?? {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.all });
      toast.success("Verification updated.");
    },
    onError: (error) => {
      const err = normalizeApiError(error);
      toast.error(err.message, { description: err.request_id ? `Request ID: ${err.request_id}` : undefined });
    },
  });
}
