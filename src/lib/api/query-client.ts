import { QueryClient } from "@tanstack/react-query";

import { retryDelay, shouldRetryQuery } from "@/lib/api/backoff";
import { isAutoRefreshable, readPaused } from "@/lib/api/auto-refresh";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        // Coming back to the tab re-reads stale data, except where auto refresh is paused or the query opted out
        // (see auto-refresh.ts). The 30 s timer itself is the AutoRefresh scheduler in the topbar, not a per-query
        // refetchInterval, so pause, open dialogs and in-flight writes are honoured; queries with their own faster poll
        // (chat, notification bell, printing queue) keep it and are never doubled.
        refetchOnWindowFocus: (query) => !readPaused() && isAutoRefreshable(query),
        refetchIntervalInBackground: false,
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
