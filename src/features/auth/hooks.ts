"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import * as authApi from "@/features/auth/api";
import { useAuthStore } from "@/features/auth/auth-store";
import type { LoginRequest } from "@/features/auth/types";
import { normalizeApiError } from "@/lib/api/errors";
import { ROUTES } from "@/lib/routes";

export function useLogin() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const clear = useAuthStore((state) => state.clear);
  return useMutation({
    mutationFn: (payload: LoginRequest) => authApi.login(payload),
    onSuccess: (session) => {
      setSession(session);
      toast.success("Signed in successfully.");
      router.replace("/ar/dashboard");
    },
    onError: (error) => {
      clear();
      toast.error(normalizeApiError(error).message);
    },
  });
}
export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clear = useAuthStore((state) => state.clear);
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clear();
      queryClient.clear();
      router.replace(ROUTES.login);
    },
  });
}
