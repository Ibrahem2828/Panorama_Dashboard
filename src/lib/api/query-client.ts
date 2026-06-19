"use client";

import { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { normalizeApiError } from "@/lib/api/errors";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: (failureCount, error) => {
          const normalized = normalizeApiError(error);
          if (normalized.status && normalized.status >= 400 && normalized.status < 500) {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
        onError: (error) => {
          const normalized = normalizeApiError(error);
          toast.error(normalized.message);
        },
      },
    },
  });
}
