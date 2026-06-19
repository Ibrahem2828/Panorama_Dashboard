"use client";

import { useQuery } from "@tanstack/react-query";

import { getDashboardStats } from "@/features/dashboard/api";
import { queryKeys } from "@/lib/api/query-keys";

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: getDashboardStats,
  });
}
