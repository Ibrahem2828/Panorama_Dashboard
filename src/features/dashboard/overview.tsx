"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Boxes, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";

import { Ltr } from "@/components/shared/ltr";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CONTRACT_META } from "@/contracts/generated/contract-meta";
import { QuickAccessPanel } from "@/features/quick-access/quick-access-panel";
import { useSession } from "@/features/session";
import { useI18n } from "@/i18n/provider";
import { apiFetch, unwrap } from "@/lib/api/browser-client";
import { formatNumber } from "@/lib/utils";
import type { ApiEnvelope } from "@/types/api";

function numericMetrics(value: unknown, prefix = ""): { key: string; value: number }[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "number") return [{ key: path, value: child }];
    return numericMetrics(child, path);
  });
}

export function DashboardOverview() {
  const { user, capabilities, source } = useSession();
  const { t, tOr, locale } = useI18n();
  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => unwrap(await apiFetch<ApiEnvelope<Record<string, unknown>>>("/api/v1/dashboard/stats/")),
    staleTime: 60_000,
  });
  const health = useQuery({
    queryKey: ["backend-health-ready"],
    queryFn: async () => {
      try {
        const response = await apiFetch<unknown>("/api/v1/health/ready/");
        return { ready: true, response };
      } catch (error) {
        return { ready: false, error };
      }
    },
    refetchInterval: 60_000,
  });
  const metrics = numericMetrics(stats.data);

  return (
    <div className="space-y-7">
      <PageHeader
        title={t("dashboard.welcome", { name: user.full_name.split(" ")[0] ?? user.full_name })}
        description={t("dashboard.subtitle")}
        eyebrow={t("dashboard.title")}
        actions={<span className="inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold"><ShieldCheck className="size-4 text-primary" aria-hidden="true" />{t(`roles.${user.role}` as "roles.admin")}</span>}
      />

      <div className="grid gap-4 xl:grid-cols-[1.55fr_.75fr]">
        <Card className="relative overflow-hidden border-0 brand-gradient text-white shadow-xl shadow-primary/15">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(255,255,255,.22),transparent_20rem)]" />
          <CardContent className="relative flex min-h-52 flex-col justify-between p-6 sm:p-8">
            <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/70"><Sparkles className="size-4" />{t("overview.controlCenter")}</div><h2 className="mt-4 max-w-2xl text-2xl font-black leading-tight sm:text-3xl">{t("app.tagline")}</h2></div>
            <div className="mt-7 flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{capabilities.includes("*") ? t("overview.fullAccess") : t("overview.capabilitiesCount", { count: formatNumber(capabilities.length, locale) })}</span><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{source === "backend" ? t("session.backendCapabilities") : t("session.compatibilityCapabilities")}</span><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{t("overview.localeTile")}</span></div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="text-primary" />{t("dashboard.systemStatus")}</CardTitle><CardDescription>{t("nav.systemHealth")}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border p-4"><div><div className="font-bold">{t("overview.backendApi")}</div><div className="mt-1 text-xs text-muted-foreground">{t("overview.secureBff")}</div></div>{health.isPending ? <Skeleton className="h-7 w-20" /> : <StatusPill value={health.data?.ready ? "healthy" : "unhealthy"} />}</div>
            <div className="flex items-center justify-between rounded-xl border p-4"><div><div className="font-bold">{t("overview.openapi")}</div><div className="mt-1 text-xs text-muted-foreground">{t("overview.sha", { sha: "" })}<Ltr as="span" className="font-mono">{CONTRACT_META.sha256.slice(0, 12)}</Ltr></div></div><StatusPill value="ready" /></div>
            {!health.data?.ready && !health.isPending ? <div className="flex gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"><TriangleAlert className="size-4 shrink-0" />{t("dashboard.backendDegraded")}</div> : null}
          </CardContent>
        </Card>
      </div>

      <QuickAccessPanel />

      <section>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black">{t("dashboard.attention")}</h2><span className="text-xs text-muted-foreground">{t("common.updatedAt")}</span></div>
        {stats.isPending ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}</div> : stats.isError ? <ErrorPanel error={stats.error} retry={() => stats.refetch()} /> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(metrics.length ? metrics : [{ key: "contract.operations", value: CONTRACT_META.operationCount }]).map((metric, index) => (
              <Card key={metric.key} className="group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
                <CardContent className="flex items-center gap-4 p-5"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Boxes className="size-5" /></div><div className="min-w-0"><div className="text-2xl font-black">{formatNumber(metric.value, locale)}</div><div className="mt-1 truncate text-xs text-muted-foreground" title={metric.key}>{tOr(`metric.${metric.key}`, t("metric.other"))}</div></div><span className="ms-auto text-[10px] text-muted-foreground">0{index + 1}</span></CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
