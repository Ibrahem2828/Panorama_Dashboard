import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry(failureCount, error) {
          const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
          if ([400, 401, 403, 404, 409, 413, 426].includes(status)) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}
