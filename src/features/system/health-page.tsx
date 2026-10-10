"use client";

import { useQueries } from "@tanstack/react-query";
import { Activity, CircleCheck, CircleX, Database, HeartPulse, Power, RefreshCw, ServerCog } from "lucide-react";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { apiFetch, unwrap } from "@/lib/api/browser-client";
import { useI18n } from "@/i18n/provider";
import type { ApiEnvelope } from "@/types/api";

const probes = [
  { key: "live", label: "health.live", path: "/api/v1/health/live/", icon: HeartPulse },
  { key: "ready", label: "health.ready", path: "/api/v1/health/ready/", icon: ServerCog },
  { key: "startup", label: "health.startup", path: "/api/v1/health/startup/", icon: Power },
  { key: "database", label: "health.database", path: "/api/v1/health/db/", icon: Database },
] as const;

interface ProbeResult {
  ok: boolean;
  status: number;
  payload: unknown;
  requestId?: string;
}

async function runProbe(path: string): Promise<ProbeResult> {
  try {
    const payload = await apiFetch<ApiEnvelope<unknown> | unknown>(path);
    return { ok: true, status: 200, payload: unwrap(payload) };
  } catch (error) {
    const value = error as { status?: number; requestId?: string; message?: string };
    return { ok: false, status: value.status ?? 0, requestId: value.requestId, payload: value.message ?? "Probe failed" };
  }
}

export function HealthPage() {
  const { t } = useI18n();
  const queries = useQueries({
    queries: probes.map((probe) => ({
      queryKey: ["health", probe.key],
      queryFn: () => runProbe(probe.path),
      refetchInterval: probe.key === "live" ? 30_000 : 60_000,
      retry: false,
    })),
  });
  const refreshing = queries.some((query) => query.isFetching);
  const refresh = () => queries.forEach((query) => void query.refetch());

  return (
    <CapabilityGate capability={CAPABILITIES.dashboard}>
      <div className="space-y-6">
        <PageHeader
          title={t("health.title")}
          description={t("health.subtitle")}
          eyebrow="Observability"
          actions={<Button variant="outline" onClick={refresh} disabled={refreshing}><RefreshCw className={refreshing ? "animate-spin" : ""} />{t("common.refresh")}</Button>}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {probes.map((probe, index) => {
            const query = queries[index]!;
            const result = query.data;
            const Icon = probe.icon;
            return (
              <Card key={probe.key} className="overflow-hidden">
                <div className={result?.ok ? "h-1 bg-emerald-500" : query.isPending ? "h-1 bg-muted" : "h-1 bg-destructive"} />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="size-5" /></div>
                    {query.isPending ? <Skeleton className="h-6 w-20" /> : <StatusPill value={result?.ok ? "healthy" : "unhealthy"} label={result?.ok ? t("health.healthy") : t("health.unhealthy")} />}
                  </div>
                  <CardTitle className="text-base">{t(probe.label)}</CardTitle>
                  <CardDescription className="font-mono text-[11px]">{probe.path}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {query.isPending ? <Skeleton className="h-14 w-full" /> : (
                    <>
                      <div className="flex items-center gap-2 font-semibold">
                        {result?.ok ? <CircleCheck className="size-4 text-emerald-500" /> : <CircleX className="size-4 text-destructive" />}
                        HTTP {result?.status || "â€”"}
                      </div>
                      <pre className="max-h-28 overflow-auto rounded-lg bg-muted/50 p-2 text-[10px] text-muted-foreground">{JSON.stringify(result?.payload ?? {}, null, 2)}</pre>
                      {result?.requestId ? <p className="text-xs text-muted-foreground">{t("common.requestId")}: <span className="font-mono">{result.requestId}</span></p> : null}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="flex-row items-center gap-3">
            <div className="rounded-xl bg-amber-500/15 p-2.5 text-amber-700 dark:text-amber-300"><Activity className="size-5" /></div>
            <div><CardTitle className="text-base">Readiness is authoritative</CardTitle><CardDescription>Never mask a 503 response. Fix the failing dependency in Coolify before promoting a release.</CardDescription></div>
          </CardHeader>
        </Card>
      </div>
    </CapabilityGate>
  );
}

