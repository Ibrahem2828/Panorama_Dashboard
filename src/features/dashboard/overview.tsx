"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowUpRight, Boxes, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { ErrorPanel } from "@/components/feedback/error-panel";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/config/constants";
import { allNavigationItems } from "@/config/navigation";
import { CONTRACT_META } from "@/contracts/generated/contract-meta";
import { useSession } from "@/features/session";
import { useI18n } from "@/i18n/provider";
import { localizePath } from "@/i18n/routing";
import { apiFetch, unwrap } from "@/lib/api/browser-client";
import { hasCapability } from "@/lib/auth/capabilities";
import { formatNumber, humanize } from "@/lib/utils";
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
  const { t, locale } = useI18n();
  const params = useParams<{ locale: Locale }>();
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
  const metrics = numericMetrics(stats.data).slice(0, 8);
  const visibleActions = allNavigationItems.filter((item) => item.href !== "/dashboard" && hasCapability(capabilities, item.capability)).slice(0, 8);

  return (
    <div className="space-y-7">
      <PageHeader
        title={t("dashboard.welcome", { name: user.full_name.split(" ")[0] ?? user.full_name })}
        description={t("dashboard.subtitle")}
        eyebrow={t("dashboard.title")}
        actions={<Button asChild variant="outline"><Link href={localizePath(params.locale, "/dashboard/settings")}><ShieldCheck />{t(`roles.${user.role}` as "roles.admin")}</Link></Button>}
      />

      <div className="grid gap-4 xl:grid-cols-[1.55fr_.75fr]">
        <Card className="relative overflow-hidden border-0 brand-gradient text-white shadow-xl shadow-primary/15">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(255,255,255,.22),transparent_20rem)]" />
          <CardContent className="relative flex min-h-52 flex-col justify-between p-6 sm:p-8">
            <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/70"><Sparkles className="size-4" />PANORAMA CONTROL CENTER</div><h2 className="mt-4 max-w-2xl text-2xl font-black leading-tight sm:text-3xl">{t("app.tagline")}</h2></div>
            <div className="mt-7 flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{capabilities.includes("*") ? "Full access" : `${capabilities.length} capabilities`}</span><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{source}</span><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">AR · EN · RTL · LTR</span></div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="text-primary" />{t("dashboard.systemStatus")}</CardTitle><CardDescription>{t("nav.systemHealth")}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border p-4"><div><div className="font-bold">Backend API</div><div className="mt-1 text-xs text-muted-foreground">Same-origin secure BFF</div></div>{health.isPending ? <Skeleton className="h-7 w-20" /> : <StatusPill value={health.data?.ready ? "healthy" : "unhealthy"} />}</div>
            <div className="flex items-center justify-between rounded-xl border p-4"><div><div className="font-bold">OpenAPI</div><div className="mt-1 text-xs text-muted-foreground">SHA {CONTRACT_META.sha256.slice(0, 12)}</div></div><StatusPill value="ready" /></div>
            {!health.data?.ready && !health.isPending ? <div className="flex gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"><TriangleAlert className="size-4 shrink-0" />{t("dashboard.backendDegraded")}</div> : null}
          </CardContent>
        </Card>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black">{t("dashboard.attention")}</h2><span className="text-xs text-muted-foreground">{t("common.updatedAt")}</span></div>
        {stats.isPending ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}</div> : stats.isError ? <ErrorPanel error={stats.error} retry={() => stats.refetch()} /> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(metrics.length ? metrics : [{ key: "contract.operations", value: CONTRACT_META.operationCount }]).map((metric, index) => (
              <Card key={metric.key} className="group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
                <CardContent className="flex items-center gap-4 p-5"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Boxes className="size-5" /></div><div className="min-w-0"><div className="text-2xl font-black">{formatNumber(metric.value, locale)}</div><div className="mt-1 truncate text-xs text-muted-foreground" title={metric.key}>{humanize(metric.key)}</div></div><span className="ms-auto text-[10px] text-muted-foreground">0{index + 1}</span></CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-black">{t("dashboard.quickActions")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleActions.map((item) => { const Icon = item.icon; return (
            <Link key={item.key} href={localizePath(params.locale, item.href)} className="group flex items-center gap-4 rounded-2xl border bg-card p-4 transition hover:border-primary/30 hover:shadow-lg">
              <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:brand-gradient group-hover:text-white"><Icon className="size-5" /></span>
              <span className="font-bold">{t(item.label)}</span><ArrowUpRight className="ms-auto size-4 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary rtl:rotate-[-90deg]" />
            </Link>
          ); })}
        </div>
      </section>
    </div>
  );
}
