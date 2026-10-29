/** Rules of the print-job queue and the operations strip (pure functions, no React). */

export const JOB_STATUSES = ["queued", "printing", "done", "failed", "cancelled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
/** Statuses the operations strip counts. A cancelled job is neither waiting nor a failure, so it is left out (and never added to "failed"). */
export const COUNTED_JOB_STATUSES = ["queued", "printing", "done", "failed"] as const;

export interface QueueJob {
  id: number;
  order_id: number;
  item: number;
  item_name: string;
  status: JobStatus;
  printer_name: string;
  sides_printed: number;
  sheets: number;
  error: string;
  created_by_name?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
}

export const JOB_PATHS = {
  list: "/api/v1/dashboard/printing/print-jobs/",
  status: (id: number) => `/api/v1/dashboard/printing/print-jobs/${id}/status/`,
  cancel: (id: number) => `/api/v1/dashboard/printing/print-jobs/${id}/cancel/`,
  retry: (id: number) => `/api/v1/dashboard/printing/print-jobs/${id}/retry/`,
  file: (id: number) => `/api/v1/dashboard/printing/print-jobs/${id}/file/`,
} as const;

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && (JOB_STATUSES as readonly string[]).includes(value);
}

/**
 * Which actions the cashier is offered for a job in a given status. A cancelled job is final on the server (it cannot be queued
 * again, the agent cannot pick it up), so it gets no open/retry: staff print the order again to get a new job.
 */
export function jobActions(status: JobStatus): { open: boolean; markDone: boolean; markFailed: boolean; retry: boolean; cancel: boolean } {
  const active = status === "queued" || status === "printing";
  return { open: status !== "done" && status !== "cancelled", markDone: active, markFailed: active, retry: status === "failed" || status === "done", cancel: active };
}

// ---- orders by stage, for the operations strip -------------------------------------------------------------------------------------

/** Order statuses that make up each stage shown on the strip. */
export const ORDER_STAGES = {
  new: ["submitted", "under_review"],
  inProgress: ["accepted", "printing"],
  ready: ["ready"],
} as const;
export type OrderStage = keyof typeof ORDER_STAGES;

/** Sums the per-status counts into stages; a missing count counts as zero. */
export function stageTotals(counts: Readonly<Record<string, number | undefined>>): Record<OrderStage, number> {
  const sum = (statuses: readonly string[]) => statuses.reduce((total, status) => total + (counts[status] ?? 0), 0);
  return { new: sum(ORDER_STAGES.new), inProgress: sum(ORDER_STAGES.inProgress), ready: sum(ORDER_STAGES.ready) };
}
