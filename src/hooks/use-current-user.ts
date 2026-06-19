"use client";

import { useAuthStore } from "@/features/auth/auth-store";

export function useCurrentUser() {
  return useAuthStore((state) => state.user);
}
