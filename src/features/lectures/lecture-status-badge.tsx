"use client";

import { AlertTriangle, CheckCircle2, Clock, Loader2, ShieldAlert } from "lucide-react";

import { isInFlight, isLectureStatus, STATUS_TONE_CLASSES, statusTone } from "@/features/lectures/lecture-rules";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages";
import { cn } from "@/lib/utils";

/** Localized label of a backend processing status (unknown values are shown as received). */
export function useLectureStatusLabel() {
  const { t } = useI18n();
  return (status: unknown): string => (isLectureStatus(status) ? t(`lectures.status.${status}` as MessageKey) : String(status ?? "—"));
}

/** The processing status as an icon plus a text label (never colour alone), with a solid light/dark colour pair. */
export function LectureStatusBadge({ status }: { status: unknown }) {
  const label = useLectureStatusLabel()(status);
  const tone = statusTone(status);
  const Icon = status === "ready" ? CheckCircle2 : status === "failed" ? AlertTriangle : status === "quarantined" ? ShieldAlert : isInFlight(status) && status !== "uploaded" && status !== "queued" ? Loader2 : Clock;
  const spinning = Icon === Loader2;
  return (
    <span
      data-status={String(status)}
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold", STATUS_TONE_CLASSES[tone])}
    >
      <Icon aria-hidden="true" className={cn("size-3.5", spinning && "animate-spin motion-reduce:animate-none")} />
      {label}
    </span>
  );
}
