/** Rules of the print-job queue, the printers view and the operations strip (pure functions, no React). */

export const JOB_STATUSES = ["queued", "printing", "done", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

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
  retry: (id: number) => `/api/v1/dashboard/printing/print-jobs/${id}/retry/`,
  file: (id: number) => `/api/v1/dashboard/printing/print-jobs/${id}/file/`,
} as const;

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && (JOB_STATUSES as readonly string[]).includes(value);
}

/** Which actions the cashier is offered for a job in a given status. */
export function jobActions(status: JobStatus): { open: boolean; markDone: boolean; markFailed: boolean; retry: boolean } {
  const active = status === "queued" || status === "printing";
  return { open: status !== "done", markDone: active, markFailed: active, retry: status === "failed" || status === "done" };
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

// ---- printers, derived from job history ----------------------------------------------------------------------------------------------

export interface PrinterSummary {
  /** The printer name as the agent reported it; "" for jobs that were never assigned a printer. */
  name: string;
  jobs: number;
  done: number;
  failed: number;
  active: number;
  sheets: number;
  lastActivityAt: string | null;
  lastStatus: JobStatus;
  lastError: string;
  /** The latest three jobs all failed: the printer (or its agent) needs a look. */
  needsAttention: boolean;
}

function stamp(job: QueueJob): string {
  return job.finished_at || job.started_at || job.created_at;
}

/** Groups jobs by printer name. The server has no printer registry, so this is all that can be known: what each printer did lately. */
export function summarizePrinters(jobs: readonly QueueJob[]): PrinterSummary[] {
  const groups = new Map<string, QueueJob[]>();
  for (const job of jobs) {
    const key = (job.printer_name ?? "").trim();
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }
  const summaries: PrinterSummary[] = [];
  for (const [name, list] of groups) {
    const newestFirst = [...list].sort((a, b) => stamp(b).localeCompare(stamp(a)) || b.id - a.id);
    const latest = newestFirst[0]!;
    const lastFailure = newestFirst.find((job) => job.status === "failed");
    const recent = newestFirst.slice(0, 3);
    summaries.push({
      name,
      jobs: list.length,
      done: list.filter((job) => job.status === "done").length,
      failed: list.filter((job) => job.status === "failed").length,
      active: list.filter((job) => job.status === "queued" || job.status === "printing").length,
      sheets: list.filter((job) => job.status === "done").reduce((total, job) => total + (job.sheets || 0), 0),
      lastActivityAt: stamp(latest) || null,
      lastStatus: latest.status,
      lastError: lastFailure?.error ?? "",
      needsAttention: recent.length === 3 && recent.every((job) => job.status === "failed"),
    });
  }
  // Named printers first, most recently used on top; the "no printer" bucket last.
  return summaries.sort((a, b) => Number(a.name === "") - Number(b.name === "") || (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""));
}
