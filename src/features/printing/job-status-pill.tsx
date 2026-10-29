"use client";

import { Ban } from "lucide-react";

import { StatusPill } from "@/components/shared/status-pill";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/provider";

/**
 * A print job's status badge. A cancelled job is a deliberate decision, not a fault, so it is drawn in neutral grey with a "stop"
 * icon (and the word), never in the red of a failed job.
 */
export function JobStatusPill({ value }: { value: string }) {
  const { enumLabel } = useI18n();
  if (value !== "cancelled") return <StatusPill value={value} />;
  return (
    <Badge variant="outline" className="gap-1.5 whitespace-nowrap rounded-full border-slate-400/40 bg-slate-500/10 px-2.5 py-1 font-semibold text-slate-700 dark:text-slate-300">
      <Ban className="size-3" aria-hidden="true" />
      {enumLabel("cancelled")}
    </Badge>
  );
}
