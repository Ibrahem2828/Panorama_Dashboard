"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Pause, Play, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import {
  AUTO_REFRESH_INTERVAL_MS, countsForIndicator, markRefreshed, readLastRefreshAt, readPaused, refreshTick, setPaused, subscribeAutoRefresh,
} from "@/lib/api/auto-refresh";
import { cn } from "@/lib/utils";

/**
 * Topbar control for the dashboard-wide refresh: runs the 30 s scheduler (see lib/api/auto-refresh.ts), shows when the
 * data was last updated, lets the operator pause/resume (remembered per browser) and refresh immediately.
 */
export function AutoRefreshControl() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const paused = useSyncExternalStore(subscribeAutoRefresh, readPaused, () => false);
  const last = useSyncExternalStore(subscribeAutoRefresh, readLastRefreshAt, () => null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success" && countsForIndicator(event.query)) markRefreshed();
    });
    return unsubscribe;
  }, [queryClient]);

  useEffect(() => {
    const timer = window.setInterval(() => { void refreshTick(queryClient); }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [queryClient]);

  const refreshNow = useCallback(async () => {
    setBusy(true);
    try { await refreshTick(queryClient, { force: true }); } finally { setBusy(false); }
  }, [queryClient]);

  const time = last === null ? "—" : new Intl.DateTimeFormat(locale === "ar" ? "ar-SY" : "en-GB", { timeStyle: "medium" }).format(new Date(last));
  const label = paused ? t("refresh.paused") : t("refresh.auto", { seconds: String(AUTO_REFRESH_INTERVAL_MS / 1000) });
  return (
    <div className="flex items-center gap-0.5 rounded-full border bg-background px-1 py-0.5 text-[11px] text-muted-foreground" data-testid="auto-refresh-control">
      <Button type="button" variant="ghost" size="icon" className="size-7 rounded-full" aria-pressed={paused} aria-label={paused ? t("refresh.resume") : t("refresh.pause")} title={paused ? t("refresh.resume") : t("refresh.pause")} onClick={() => setPaused(!paused)}>
        {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
      </Button>
      <span className="hidden px-1 xl:inline" data-testid="auto-refresh-status">{label} · {t("refresh.last", { time })}</span>
      <Button type="button" variant="ghost" size="icon" className="size-7 rounded-full" aria-label={t("refresh.now")} title={`${label} · ${t("refresh.last", { time })}`} disabled={busy} onClick={() => void refreshNow()}>
        <RefreshCw className={cn("size-3.5", busy && "animate-spin motion-reduce:animate-none")} />
      </Button>
    </div>
  );
}
