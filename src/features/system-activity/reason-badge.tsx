"use client";

import { ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { reasonLabelKey, reasonTone } from "@/features/system-activity/rules";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/** Arabic reason badge of a failed login (an unknown code from a newer backend shows the generic text). */
export function ReasonBadge({ reason, className }: { reason: unknown; className?: string }) {
  const { t } = useI18n();
  return (
    <Badge variant={reasonTone(reason)} className={cn("whitespace-nowrap", className)} data-testid="login-reason" data-reason={typeof reason === "string" ? reason : "unknown"}>
      <ShieldAlert className="me-1 size-3" aria-hidden />
      {t(reasonLabelKey(reason))}
    </Badge>
  );
}
