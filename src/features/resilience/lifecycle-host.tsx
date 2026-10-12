"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Wrench } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { onMaintenance, onUpdateRequired } from "@/lib/api/browser-client";
import type { AppApiError, MaintenanceInfo } from "@/lib/api/errors";

import { nextCheckDelaySeconds, probeService, secondsRemaining } from "./probe";

type Lifecycle = { kind: "maintenance"; info: MaintenanceInfo } | { kind: "update"; messageAr?: string; messageEn?: string } | null;

function MaintenanceScreen({ info, onRecovered }: { info: MaintenanceInfo; onRecovered: () => void }) {
  const { locale, t } = useI18n();
  const [deadline, setDeadline] = useState(() => Date.now() + nextCheckDelaySeconds(info.retryAfterSeconds, 0) * 1000);
  const [remaining, setRemaining] = useState(() => nextCheckDelaySeconds(info.retryAfterSeconds, 0));
  const [checking, setChecking] = useState(false);
  const [lastFailed, setLastFailed] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const failures = useRef(0);
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    const result = await probeService();
    busy.current = false;
    setChecking(false);
    if (result === "up") {
      setRecovered(true);
      window.setTimeout(onRecovered, 800);
      return;
    }
    failures.current += 1;
    setLastFailed(true);
    const next = nextCheckDelaySeconds(info.retryAfterSeconds, failures.current);
    setDeadline(Date.now() + next * 1000);
    setRemaining(next);
  }, [info.retryAfterSeconds, onRecovered]);

  // Countdown (deadline-anchored, so background tabs stay accurate) and auto-recovery when it reaches zero.
  useEffect(() => {
    const id = window.setInterval(() => {
      const left = secondsRemaining(deadline, Date.now());
      setRemaining(left);
      if (left <= 0) void check();
    }, 500);
    return () => window.clearInterval(id);
  }, [check, deadline]);

  const title = (locale === "ar" ? info.titleAr : info.titleEn) ?? info.titleEn ?? info.titleAr ?? t("resilience.maintenance.title");
  const message = (locale === "ar" ? info.messageAr : info.messageEn) ?? t("resilience.maintenance.message");
  const end = info.estimatedEndAt ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(info.estimatedEndAt)) : "";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center" aria-labelledby="maintenance-title" aria-describedby="maintenance-message">
      <div className="grid size-16 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <Wrench className="size-8" aria-hidden />
      </div>
      <h1 id="maintenance-title" className="text-2xl font-extrabold">{title}</h1>
      <p id="maintenance-message" className="max-w-md text-muted-foreground">{message}</p>
      {end ? <p className="text-sm font-semibold"><bdi>{t("resilience.maintenance.estimatedEnd", { date: end })}</bdi></p> : null}
      <div role="status" aria-live="polite" className="min-h-6 text-sm text-muted-foreground">
        {recovered ? t("resilience.maintenance.recovered") : checking ? t("resilience.maintenance.retrying") : lastFailed ? t("resilience.maintenance.stillDown") : t("resilience.maintenance.autoRetry")}
      </div>
      <Button onClick={() => void check()} isLoading={checking} disabled={checking || recovered}>
        {checking ? null : <RefreshCw aria-hidden />}
        {checking ? t("resilience.maintenance.retrying") : remaining > 0 ? `${t("common.retry")} (${t("resilience.maintenance.retryIn", { seconds: remaining })})` : t("common.retry")}
      </Button>
    </main>
  );
}

function UpdateScreen({ messageAr, messageEn }: { messageAr?: string; messageEn?: string }) {
  const { locale, t } = useI18n();
  const message = (locale === "ar" ? messageAr : messageEn) ?? t("resilience.update.message");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center" aria-labelledby="update-title" aria-describedby="update-message">
      <div className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
        <RefreshCw className="size-8" aria-hidden />
      </div>
      <h1 id="update-title" className="text-2xl font-extrabold">{t("resilience.update.title")}</h1>
      <p id="update-message" className="max-w-md text-muted-foreground">{message}</p>
      <Button onClick={() => window.location.reload()}><RefreshCw aria-hidden />{t("resilience.update.reload")}</Button>
    </main>
  );
}

/**
 * Global handler for backend lifecycle states (503 MAINTENANCE_MODE, 426 APP_UPDATE_REQUIRED). The app stays mounted
 * (and inert) underneath so in-progress state and drafts survive; the screen replaces it for the user.
 */
export function LifecycleHost({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<Lifecycle>(null);

  useEffect(() => {
    onMaintenance((error: AppApiError) => setState((current) => (current?.kind === "update" ? current : { kind: "maintenance", info: error.maintenance ?? {} })));
    onUpdateRequired((error: AppApiError) => setState({ kind: "update", messageAr: error.maintenance?.messageAr, messageEn: error.maintenance?.messageEn }));
    return () => {
      onMaintenance(null);
      onUpdateRequired(null);
    };
  }, []);

  const recovered = useCallback(() => {
    setState(null);
    void queryClient.invalidateQueries();
  }, [queryClient]);

  return (
    <>
      <div inert={state ? true : undefined} aria-hidden={state ? true : undefined}>{children}</div>
      {state ? (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-background" data-lifecycle={state.kind}>
          {state.kind === "maintenance" ? <MaintenanceScreen info={state.info} onRecovered={recovered} /> : <UpdateScreen messageAr={state.messageAr} messageEn={state.messageEn} />}
        </div>
      ) : null}
    </>
  );
}
