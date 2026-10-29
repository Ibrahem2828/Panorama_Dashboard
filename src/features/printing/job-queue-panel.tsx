"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Pagination } from "@/components/data-grid/pagination";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { openJobPdf } from "@/features/printing/print-job-api";
import { JOB_PATHS, JOB_STATUSES, jobActions, type QueueJob } from "@/features/printing/print-queue-rules";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";

const REFRESH_MS = 8_000;

function formatWhen(value: string | null | undefined, locale: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(locale === "ar" ? "ar-SY" : "en-GB", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Every print job of every order in one list: what is waiting, what is on a printer, what finished and what failed. It refreshes
 * itself while the tab is visible (the browser pauses the timer in a background tab).
 */
export function JobQueuePanel({ status, orderFilter, page, pageSize, onChange }: {
  status: string;
  orderFilter: string;
  page: number;
  pageSize: number;
  onChange: (changes: Record<string, string | number | null>) => void;
}) {
  const { t, enumLabel, locale } = useI18n();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<number | null>(null);
  const orderId = /^\d+$/u.test(orderFilter.trim()) ? orderFilter.trim() : "";

  const query = useQuery({
    queryKey: ["print-jobs", "queue", status, orderId, page, pageSize],
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize), ordering: "-created_at" });
      if (status !== "all") params.set("status", status);
      if (orderId) params.set("order", orderId);
      return normalizeCollection<QueueJob>(await apiFetch(`${JOB_PATHS.list}?${params}`));
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["print-jobs"] });
    void queryClient.invalidateQueries({ queryKey: ["printing-orders"] });
  };
  const setStatus = useMutation({
    mutationFn: async (input: { job: QueueJob; status: "printing" | "done" | "failed"; error?: string }) => {
      setBusy(input.job.id);
      return apiFetch(JOB_PATHS.status(input.job.id), { method: "PATCH", body: { status: input.status, ...(input.error ? { error: input.error } : {}) } });
    },
    onSuccess: refresh,
    onError: () => toast.error(t("printing.job.statusFailed")),
    onSettled: () => setBusy(null),
  });
  const retry = useMutation({
    mutationFn: async (job: QueueJob) => { setBusy(job.id); return apiFetch(JOB_PATHS.retry(job.id), { method: "POST" }); },
    onSuccess() { toast.success(t("queue.requeued")); refresh(); },
    onError: () => toast.error(t("queue.retryFailed")),
    onSettled: () => setBusy(null),
  });
  async function open(job: QueueJob) {
    setBusy(job.id);
    const ok = await openJobPdf(job.id);
    setBusy(null);
    if (!ok) { toast.error(t("printing.job.openFailed")); return; }
    if (job.status === "queued") setStatus.mutate({ job, status: "printing" });
  }

  const jobs = query.data?.results ?? [];
  return (
    <div className="space-y-4">
      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl border p-3">
        <Select value={status} onValueChange={(value) => onChange({ jstatus: value === "all" ? null : value, page: 1 })}>
          <SelectTrigger className="w-44" aria-label={t("common.status")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("queue.allStatuses")}</SelectItem>
            {JOB_STATUSES.map((value) => <SelectItem key={value} value={value}>{enumLabel(value)}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t("queue.orderNumber")}</span>
          <Input
            className="h-9 w-28 text-center tabular-nums"
            dir="ltr" inputMode="numeric" value={orderFilter}
            onChange={(event) => onChange({ jorder: event.target.value.replace(/\D/gu, "").slice(0, 9), page: 1 })}
          />
        </label>
        <p className="ms-auto flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />{t("queue.live", { seconds: REFRESH_MS / 1000 })}
        </p>
        <Button variant="outline" onClick={() => query.refetch()}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />{t("common.refresh")}</Button>
      </div>

      {query.isPending ? <Skeleton className="h-96 rounded-2xl" /> : query.isError ? <ErrorPanel error={query.error} retry={() => query.refetch()} /> : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="w-16 p-3 text-start font-semibold">#</th>
                  <th scope="col" className="p-3 text-start font-semibold">{t("queue.file")}</th>
                  <th scope="col" className="p-3 text-start font-semibold">{t("queue.order")}</th>
                  <th scope="col" className="p-3 text-start font-semibold">{t("common.status")}</th>
                  <th scope="col" className="p-3 text-start font-semibold">{t("queue.printer")}</th>
                  <th scope="col" className="p-3 text-start font-semibold">{t("queue.created")}</th>
                  <th scope="col" className="p-3 text-start font-semibold"><span className="sr-only">{t("common.actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const actions = jobActions(job.status);
                  const working = busy === job.id;
                  return (
                    <tr key={job.id} className="border-t align-top hover:bg-muted/30">
                      <td className="p-3 font-mono tabular-nums">{job.id}</td>
                      <td className="min-w-[12rem] p-3">
                        <p className="break-words font-semibold" dir="auto">{job.item_name || "—"}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground"><bdi>{t("printing.job.faces", { faces: job.sides_printed, sheets: job.sheets })}</bdi></p>
                      </td>
                      <td className="p-3">
                        <Link className="font-semibold text-primary underline-offset-4 hover:underline" href={`/${locale}/dashboard/printing?tab=orders&order=${job.order_id}`}>#{job.order_id}</Link>
                      </td>
                      <td className="p-3">
                        <StatusPill value={job.status} />
                        {job.error ? <p className="mt-1 max-w-[16rem] break-words text-xs text-destructive">{job.error}</p> : null}
                      </td>
                      <td className="p-3">{job.printer_name || <span className="text-muted-foreground">{t("queue.noPrinter")}</span>}</td>
                      <td className="whitespace-nowrap p-3 text-xs text-muted-foreground"><bdi>{formatWhen(job.created_at, locale)}</bdi></td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1.5">
                          {actions.open ? <Button size="sm" disabled={working} onClick={() => void open(job)}><ExternalLink />{t("printing.job.open")}</Button> : null}
                          {actions.markDone ? <Button size="sm" variant="outline" disabled={working} onClick={() => setStatus.mutate({ job, status: "done" })}><CheckCircle2 />{t("printing.job.markDone")}</Button> : null}
                          {actions.markFailed ? <Button size="sm" variant="outline" disabled={working} onClick={() => setStatus.mutate({ job, status: "failed", error: t("printing.job.failedDefault") })}><XCircle />{t("printing.job.markFailed")}</Button> : null}
                          {actions.retry ? <Button size="sm" variant="outline" disabled={working} onClick={() => retry.mutate(job)}><RotateCcw />{job.status === "done" ? t("printing.job.printAgain") : t("printing.job.retry")}</Button> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!jobs.length ? <div className="p-10 text-center text-muted-foreground">{t("queue.empty")}</div> : null}
        </div>
      )}
      {query.data ? <Pagination page={page} pageSize={pageSize} count={query.data.count} onPage={(next) => onChange({ page: next })} onPageSize={(next) => onChange({ page_size: next, page: 1 })} /> : null}
    </div>
  );
}
