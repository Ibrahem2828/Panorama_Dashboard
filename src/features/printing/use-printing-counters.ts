"use client";

import { useQueries } from "@tanstack/react-query";

import { useLowStockState } from "@/features/finance/low-stock";
import { COUNTED_JOB_STATUSES, ORDER_STAGES, stageTotals, type JobStatus, type OrderStage } from "@/features/printing/print-queue-rules";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";

const ORDER_STATUSES = Object.values(ORDER_STAGES).flat();

async function countOf(path: string): Promise<number> {
  return (await normalizeCollection<unknown>(await apiFetch(path))).count;
}

/** Live numbers for the operations strip: orders by stage, jobs by status and low-stock items. Refreshed every 30 seconds. */
export function usePrintingCounters() {
  const orders = useQueries({
    queries: ORDER_STATUSES.map((status) => ({
      queryKey: ["printing-orders", "count", status],
      refetchInterval: 30_000,
      queryFn: () => countOf(`/api/v1/dashboard/printing/orders/?status=${status}&page_size=1`),
    })),
  });
  const jobs = useQueries({
    queries: COUNTED_JOB_STATUSES.map((status) => ({
      queryKey: ["print-jobs", "count", status],
      refetchInterval: 15_000,
      queryFn: () => countOf(`/api/v1/dashboard/printing/print-jobs/?status=${status}&page_size=1`),
    })),
  });
  const orderCounts = Object.fromEntries(ORDER_STATUSES.map((status, index) => [status, orders[index]?.data]));
  const jobCounts = Object.fromEntries(COUNTED_JOB_STATUSES.map((status, index) => [status, jobs[index]?.data])) as Partial<Record<JobStatus, number>>;
  const lowStock = useLowStockState();
  return {
    stages: stageTotals(orderCounts) as Record<OrderStage, number>,
    ordersReady: orders.every((query) => query.isSuccess),
    jobs: jobCounts,
    jobsReady: jobs.every((query) => query.isSuccess),
    lowStock: lowStock.ready ? lowStock.items.length : null,
  };
}
