"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import * as authApi from "@/features/auth/api";
import { useAuthStore } from "@/features/auth/auth-store";
import type { LoginRequest } from "@/features/auth/types";
import { normalizeApiError } from "@/lib/api/errors";
import { isDashboardRole } from "@/lib/permissions";
import { getDefaultDashboardRoute, ROUTES } from "@/lib/routes";

export function useLogin() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const clear = useAuthStore((state) => state.clear);

  return useMutation({
    mutationFn: (payload: LoginRequest) => authApi.login(payload),
    onSuccess: (data) => {
      if (!isDashboardRole(data.user.role)) {
        clear();
        toast.error("This account does not have permission to access the dashboard.");
        return;
      }

      setSession({ access: data.access, refresh: data.refresh }, data.user);
      toast.success("Signed in successfully.");
      router.replace(getDefaultDashboardRoute(data.user.role));
    },
    onError: (error) => {
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
    onSettled: (_data, error) => {
      clear();
      queryClient.clear();
      router.replace(ROUTES.login);
      if (error) {
        toast.message("Signed out locally. Backend logout was not reachable.");
      } else {
        toast.success("Signed out.");
      }
    },
  });
}
