"use client";

import { useQuery } from "@tanstack/react-query";

import { storePath, type StoreSummary } from "@/features/store/store-rules";
import { apiFetch, unwrap } from "@/lib/api/browser-client";

/** Counts by status, today's orders and the low-stock variants; shared by the landing widget and the order tabs. */
export function useStoreSummary() {
  return useQuery({
    queryKey: ["store-summary"],
    queryFn: async () => (await unwrap<StoreSummary>(apiFetch(storePath("summary")))) as StoreSummary,
  });
}
