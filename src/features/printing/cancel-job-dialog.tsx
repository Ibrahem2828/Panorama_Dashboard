"use client";

import { useMutation } from "@tanstack/react-query";
import { Ban } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { JOB_PATHS, type QueueJob } from "@/features/printing/print-queue-rules";
import { displayServerMessage } from "@/features/printing/server-errors";
import { useI18n } from "@/i18n/provider";
import { apiFetch } from "@/lib/api/browser-client";
import { apiErrorText } from "@/lib/api/error-message";
import { AppApiError } from "@/lib/api/errors";

export const CANCEL_REASON_MAX = 255;

/** Request body of a cancel: the reason is optional and sent only when typed. */
export function cancelBody(reason: string): Record<string, unknown> {
  const text = reason.trim().slice(0, CANCEL_REASON_MAX);
  return text ? { reason: text } : {};
}

/**
 * Asks before cancelling a queued or printing job and lets the cashier note why. A 409 (the job already finished, or was cancelled
 * meanwhile) shows the server's sentence inside the dialog and refreshes the queue so the row shows the real state.
 */
export function CancelJobDialog({ job, onClose, onDone }: { job: QueueJob; onClose: () => void; onDone: () => void }) {
  const { t, locale } = useI18n();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const cancel = useMutation({
    mutationFn: async () => apiFetch(JOB_PATHS.cancel(job.id), { method: "POST", body: cancelBody(reason) }),
    onSuccess() {
      toast.success(t("queue.cancelled"));
      onDone();
      onClose();
    },
    onError(error) {
      if (error instanceof AppApiError && error.status === 409) {
        const reasonText = displayServerMessage(error.message, locale, "");
        setMessage(`${t("queue.cancelConflict")}${reasonText && reasonText !== "Conflict" ? ` ${reasonText}` : ""}`);
        onDone();
        return;
      }
      setMessage(apiErrorText(error, t));
    },
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !cancel.isPending) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader className="pe-10">
          <DialogTitle>{t("queue.cancelTitle", { id: job.id })}</DialogTitle>
          <DialogDescription>{t("queue.cancelBody", { name: job.item_name || "—" })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor={`cancel-reason-${job.id}`}>{t("queue.cancelReason")} <span className="text-xs font-normal text-muted-foreground">({t("counter.optional")})</span></Label>
          <Textarea id={`cancel-reason-${job.id}`} rows={3} maxLength={CANCEL_REASON_MAX} value={reason} onChange={(event) => setReason(event.target.value)} dir="auto" />
        </div>
        {message ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p> : null}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={onClose} disabled={cancel.isPending}>{t("queue.cancelKeep")}</Button>
          <Button type="button" variant="destructive" onClick={() => { setMessage(null); cancel.mutate(); }} disabled={cancel.isPending}><Ban />{t("queue.cancelConfirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
