import { QueryClient } from "@tanstack/react-query";

import { retryDelay, shouldRetryQuery } from "@/lib/api/backoff";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        // Only idempotent reads are ever retried: never 4xx, rate limits, maintenance or forced-update; back off
        // (honouring Retry-After) otherwise.
        retry: shouldRetryQuery,
        retryDelay: (attempt, error) => retryDelay(attempt, error),
      },
      // Writes are never auto-retried and are paused while offline (forms also disable their submit buttons).
      mutations: { retry: false, networkMode: "online" },
    },
  });
}
