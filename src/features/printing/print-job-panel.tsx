"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Printer, RotateCcw, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { openJobPdf } from "@/features/printing/print-job-api";
import { parseItemOptions, printerSettings } from "@/features/printing/print-options";
import { parseOrderItems } from "@/features/printing/print-order-rules";
import { SheetSimulation } from "@/features/printing/sheet-simulation";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";

interface PrintJob {
  id: number;
  order_id: number;
  item: number;
  item_name: string;
  status: "queued" | "printing" | "done" | "failed";
  printer_name: string;
  sides_printed: number;
  sheets: number;
  error: string;
}

const PRINTABLE = new Set(["submitted", "under_review", "accepted", "printing", "ready"]);

/**
 * Sends an order's files to the printer: prepares the print-ready PDF on the server (pages per sheet, copies and two-sided already
 * applied), opens it in the browser's print dialog and follows each file's status. The side panel shows what the customer asked for
 * and the printer settings to choose, so the paper comes out exactly as ordered.
 */
export function PrintJobPanel({ orderId, status, source, items: rawItems }: { orderId: number; status: string; source: string; items: unknown }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [failure, setFailure] = useState<Record<number, string>>({});
  const rawList = useMemo(() => (Array.isArray(rawItems) ? (rawItems as Record<string, unknown>[]) : []), [rawItems]);
  const items = useMemo(() => parseOrderItems(rawItems), [rawItems]);
  const canPrint = source !== "counter" && PRINTABLE.has(status);

  const jobsKey = ["print-jobs", orderId];
  const jobs = useQuery({
    queryKey: jobsKey,
    enabled: open,
    refetchInterval: open ? 5000 : false,
    queryFn: async () => normalizeCollection<PrintJob>(await apiFetch(`/api/v1/dashboard/printing/print-jobs/?order=${orderId}&ordering=-created_at&page_size=50`)),
  });
  const latestByItem = useMemo(() => {
    const map = new Map<number, PrintJob>();
    for (const job of jobs.data?.results ?? []) if (!map.has(job.item)) map.set(job.item, job);
    return map;
  }, [jobs.data]);

  const queue = useMutation({
    mutationFn: async (itemIds?: number[]) => apiFetch(`/api/v1/dashboard/printing/orders/${orderId}/print-jobs/`, { method: "POST", body: itemIds ? { item_ids: itemIds } : {} }),
    onSuccess: async () => { toast.success(t("printing.job.queued")); await queryClient.invalidateQueries({ queryKey: jobsKey }); await queryClient.invalidateQueries({ queryKey: ["printing-orders"] }); },
    onError: () => toast.error(t("printing.job.queueFailed")),
  });
  const setStatus = useMutation({
    mutationFn: async (input: { id: number; status: string; error?: string }) => apiFetch(`/api/v1/dashboard/printing/print-jobs/${input.id}/status/`, { method: "PATCH", body: { status: input.status, error: input.error } }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: jobsKey }); await queryClient.invalidateQueries({ queryKey: ["printing-orders"] }); },
    onError: () => toast.error(t("printing.job.statusFailed")),
  });
  const retry = useMutation({
    mutationFn: async (id: number) => apiFetch(`/api/v1/dashboard/printing/print-jobs/${id}/retry/`, { method: "POST" }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: jobsKey }); },
  });

  /** Shows the print-ready PDF in a new tab, where the browser's print dialog (Ctrl+P) takes over. */
  async function openFile(job: PrintJob) {
    if (!(await openJobPdf(job.id))) { toast.error(t("printing.job.openFailed")); return; }
    if (job.status === "queued") setStatus.mutate({ id: job.id, status: "printing" });
  }

  if (!canPrint) return null;

  return (
    <>
      <Button onClick={() => setOpen(true)}><Printer />{t("printing.job.button")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("printing.job.title", { id: orderId })}</DialogTitle>
            <DialogDescription>{t("printing.job.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {items.map((item, index) => {
              const raw = rawList.find((entry) => entry.id === item.id) ?? rawList[index] ?? {};
              const options = parseItemOptions(raw);
              const settings = printerSettings(item, options);
              const job = latestByItem.get(Number(item.id));
              return (
                <section key={String(item.id)} className="grid gap-3 rounded-xl border p-3 md:grid-cols-[1fr_16rem]">
                  <div className="space-y-2">
                    <p className="font-semibold" dir="auto">{item.fileName || t("printing.unnamedFile")}</p>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">{t("printing.job.copies")}</dt><dd><bdi>{item.copies}</bdi> {item.copies > 1 ? `(${t(options.collate ? "printing.job.collated" : "printing.job.uncollated")})` : ""}</dd>
                      <dt className="text-muted-foreground">{t("printing.job.pagesPerSheet")}</dt><dd><bdi>{options.pagesPerSheet}</bdi></dd>
                      <dt className="text-muted-foreground">{t("printing.job.range")}</dt><dd><bdi>{options.pageRange || t("printing.job.allPages")}</bdi></dd>
                      <dt className="text-muted-foreground">{t("printing.job.orientation")}</dt><dd>{t(`printing.job.orientation.${options.orientation}`)}</dd>
                      {options.cover ? <><dt className="text-muted-foreground">{t("printing.job.cover")}</dt><dd><bdi>{options.cover}</bdi></dd></> : null}
                      {options.wireGrams ? <><dt className="text-muted-foreground">{t("printing.job.wire")}</dt><dd><bdi>{options.wireGrams} g</bdi></dd></> : null}
                    </dl>
                    <div className="rounded-lg bg-amber-500/10 p-2 text-xs">
                      <p className="mb-1 font-bold">{t("printing.job.printerSettings")}</p>
                      <p>{t("printing.job.settingDuplex")}: {t(`printing.job.duplex.${settings.duplex}`)} · {t("printing.job.settingColor")}: {t(`printing.job.color.${settings.color}`)} · {t("printing.job.settingPaper")}: {settings.paper} · {t("printing.job.settingCopies")}: {settings.copies}</p>
                      <p className="mt-1 text-muted-foreground">{t("printing.job.copiesNote")}</p>
                    </div>
                    {job ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <StatusPill value={job.status} />
                        <span className="text-xs text-muted-foreground">{t("printing.job.faces", { faces: job.sides_printed, sheets: job.sheets })}</span>
                        {job.error ? <span className="text-xs text-destructive">{job.error}</span> : null}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {!job || job.status === "done" ? (
                        <Button size="sm" variant={job ? "outline" : "default"} onClick={() => queue.mutate([Number(item.id)])} isLoading={queue.isPending}>{job ? t("printing.job.printAgain") : t("printing.job.prepare")}</Button>
                      ) : null}
                      {job && job.status !== "done" ? <Button size="sm" onClick={() => void openFile(job)}><ExternalLink />{t("printing.job.open")}</Button> : null}
                      {job && (job.status === "queued" || job.status === "printing") ? <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: job.id, status: "done" })}><CheckCircle2 />{t("printing.job.markDone")}</Button> : null}
                      {job && (job.status === "queued" || job.status === "printing") ? (
                        <span className="flex items-center gap-1">
                          <Input className="h-8 w-40" placeholder={t("printing.job.failReason")} value={failure[job.id] ?? ""} onChange={(event) => setFailure((current) => ({ ...current, [job.id]: event.target.value }))} />
                          <Button size="sm" variant="destructive" onClick={() => setStatus.mutate({ id: job.id, status: "failed", error: failure[job.id] || t("printing.job.failedDefault") })}><XCircle />{t("printing.job.markFailed")}</Button>
                        </span>
                      ) : null}
                      {job?.status === "failed" ? <Button size="sm" variant="outline" onClick={() => retry.mutate(job.id)}><RotateCcw />{t("printing.job.retry")}</Button> : null}
                    </div>
                  </div>
                  <SheetSimulation item={{ pages: item.pages, copies: item.copies, sides: item.sides, options }} />
                </section>
              );
            })}
            {items.length > 1 ? <Button variant="outline" onClick={() => queue.mutate(undefined)} isLoading={queue.isPending}>{t("printing.job.prepareAll")}</Button> : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
