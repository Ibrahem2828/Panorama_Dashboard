"use client";

import { Wifi, WifiOff } from "lucide-react";

import { useOnline } from "@/hooks/use-online";
import { useI18n } from "@/i18n/provider";

export function ConnectivityIndicator() {
  // React Query's onlineManager is the source of truth shared with the offline banner and paused requests.
  const online = useOnline();
  const { t } = useI18n();
  return (
    <div className="hidden items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground xl:flex" title={online ? t("common.online") : t("common.offline")}>
      {online ? <Wifi className="size-3.5 text-emerald-500" /> : <WifiOff className="size-3.5 text-destructive" />}
      {online ? t("common.online") : t("common.offline")}
    </div>
  );
}
