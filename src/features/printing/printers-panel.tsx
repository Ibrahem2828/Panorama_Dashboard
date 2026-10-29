"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, Printer, RefreshCw } from "lucide-react";

import { ErrorPanel } from "@/components/feedback/error-panel";
import { StatusPill } from "@/components/shared/status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { JOB_PATHS, summarizePrinters, type QueueJob } from "@/features/printing/print-queue-rules";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";

/** How many of the latest jobs the summary is built from (one page of the job list). */
export const PRINTER_SAMPLE = 100;

/**
 * Printers and stations. The server has no printer/station registry (no create, edit, disable, heartbeat or agent status), so this
 * tab only reports what the print-job history shows: which printers received work lately and how it went. The notice says so.
 */
export function PrintersPanel() {
  const { t, locale } = useI18n();
  const query = useQuery({
    queryKey: ["print-jobs", "printers"],
    refetchInterval: 30_000,
    queryFn: async () => normalizeCollection<QueueJob>(await apiFetch(`${JOB_PATHS.list}?page_size=${PRINTER_SAMPLE}&ordering=-created_at`)),
  });
  const printers = summarizePrinters(query.data?.results ?? []);
  const when = (value: string | null) => (value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString(locale === "ar" ? "ar-SY" : "en-GB", { dateStyle: "short", timeStyle: "short" }) : "—");

  return (
    <div className="space-y-4">
      <div role="note" className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-900 dark:text-amber-100">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-bold">{t("printers.noticeTitle")}</p>
          <p>{t("printers.noticeBody")}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("printers.sample", { count: Math.min(query.data?.results.length ?? 0, PRINTER_SAMPLE) })}</p>
        <Button variant="outline" onClick={() => query.refetch()}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />{t("common.refresh")}</Button>
      </div>
      {query.isPending ? <Skeleton className="h-64 rounded-2xl" /> : query.isError ? <ErrorPanel error={query.error} retry={() => query.refetch()} /> : !printers.length ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">{t("printers.empty")}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {printers.map((printer) => (
            <article key={printer.name || "none"} className="space-y-3 rounded-2xl border bg-card p-4" aria-label={printer.name || t("queue.noPrinter")}>
              <header className="flex items-start justify-between gap-2">
                <h3 className="flex min-w-0 items-center gap-2 font-bold"><Printer className="size-4 shrink-0 text-primary" aria-hidden="true" /><span className="break-words" dir="auto">{printer.name || t("queue.noPrinter")}</span></h3>
                <StatusPill value={printer.lastStatus} />
              </header>
              {printer.needsAttention ? <Badge variant="destructive" className="gap-1"><AlertTriangle className="size-3" aria-hidden="true" />{t("printers.attention")}</Badge> : null}
              <dl className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded-lg bg-muted/40 p-2"><dt className="text-muted-foreground">{t("printers.jobs")}</dt><dd className="text-base font-black tabular-nums">{printer.jobs}</dd></div>
                <div className="rounded-lg bg-muted/40 p-2"><dt className="text-muted-foreground">{t("printers.done")}</dt><dd className="text-base font-black tabular-nums">{printer.done}</dd></div>
                <div className="rounded-lg bg-muted/40 p-2"><dt className="text-muted-foreground">{t("printers.failed")}</dt><dd className="text-base font-black tabular-nums">{printer.failed}</dd></div>
                <div className="rounded-lg bg-muted/40 p-2"><dt className="text-muted-foreground">{t("printers.sheets")}</dt><dd className="text-base font-black tabular-nums">{printer.sheets}</dd></div>
              </dl>
              <p className="text-xs text-muted-foreground"><bdi>{t("printers.lastActivity", { when: when(printer.lastActivityAt) })}</bdi></p>
              {printer.lastError ? <p className="break-words rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{printer.lastError}</p> : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
