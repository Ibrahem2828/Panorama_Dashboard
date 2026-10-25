"use client";

import { useQuery } from "@tanstack/react-query";
import { BellRing, CheckCircle2, Hourglass, RefreshCw, Smartphone, TriangleAlert, XCircle } from "lucide-react";
import { useState } from "react";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Ltr } from "@/components/shared/ltr";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/provider";
import { apiFetch, unwrap } from "@/lib/api/browser-client";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { formatDate, formatNumber } from "@/lib/utils";
import type { ApiEnvelope } from "@/types/api";

type Range = "24h" | "7d";

interface Health {
  range: Range;
  since: string;
  pushes: { total: number; sent: number; delivered: number; failed: number; dead: number; delivery_rate: number | null; awaiting_receipt: number };
  by_category: Record<string, Record<string, number>>;
  top_errors: { error_code: string; n: number }[];
  recent_failures: { id: number; category: string; status: string; error_code: string; created_at: string }[];
  devices: { active: number; deactivated: number; dead_in_range: number };
  in_app: { created: number; unread: number };
}

/** Notification health (system administrators): how many pushes went out, arrived, failed, and how many devices are gone. */
export function NotificationHealthPage() {
  const { t, locale } = useI18n();
  const [range, setRange] = useState<Range>("24h");
  const query = useQuery({
    queryKey: ["notification-health", range],
    queryFn: async () => unwrap(await apiFetch<ApiEnvelope<Health>>(`/api/v1/dashboard/notifications/health/?range=${range}`)),
    refetchInterval: 60_000,
  });
  const data = query.data;
  const rate = data?.pushes.delivery_rate;
  const categoryName = (key: string) => t(`inbox.category.${key}` as "inbox.category.general");
  const cards = data
    ? [
        { key: "sent", icon: BellRing, value: data.pushes.total, tone: "text-primary" },
        { key: "delivered", icon: CheckCircle2, value: data.pushes.delivered, tone: "text-emerald-600" },
        { key: "failed", icon: XCircle, value: data.pushes.failed, tone: "text-destructive" },
        { key: "dead", icon: Smartphone, value: data.pushes.dead, tone: "text-amber-600" },
        { key: "waiting", icon: Hourglass, value: data.pushes.awaiting_receipt, tone: "text-muted-foreground" },
      ]
    : [];
  return (
    <CapabilityGate capability={CAPABILITIES.system}>
      <div className="space-y-6">
        <PageHeader
          title={t("notifHealth.title")}
          description={t("notifHealth.subtitle")}
          actions={
            <div className="flex items-center gap-2">
              {(["24h", "7d"] as const).map((value) => (
                <Button key={value} size="sm" variant={range === value ? "default" : "outline"} aria-pressed={range === value} onClick={() => setRange(value)}>{t(value === "24h" ? "notifHealth.range24h" : "notifHealth.range7d")}</Button>
              ))}
              <Button size="sm" variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className="size-4" />{t("common.refresh")}</Button>
            </div>
          }
        />
        {query.isPending ? <Skeleton className="h-64 rounded-2xl" /> : query.isError ? <ErrorPanel error={query.error} retry={() => query.refetch()} /> : data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {cards.map((card) => { const Icon = card.icon; return (
                <Card key={card.key}><CardContent className="flex items-center gap-3 p-4"><Icon className={`size-6 ${card.tone}`} /><div><div className="text-2xl font-black">{formatNumber(card.value, locale)}</div><div className="text-xs text-muted-foreground">{t(`notifHealth.${card.key}` as "notifHealth.sent")}</div></div></CardContent></Card>
              ); })}
            </div>
            <Card>
              <CardHeader><CardTitle>{t("notifHealth.rate")}</CardTitle><CardDescription>{t("notifHealth.rateHint")}</CardDescription></CardHeader>
              <CardContent>
                {rate === null || rate === undefined ? <p className="text-sm text-muted-foreground">{t("notifHealth.noReceipts")}</p> : (
                  <div className="space-y-2">
                    <div className="text-3xl font-black">{new Intl.NumberFormat(locale === "ar" ? "ar-SY" : "en-US", { style: "percent", maximumFractionDigits: 1 }).format(rate)}</div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(rate * 100)} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(rate * 100)}%` }} /></div>
                    {rate < 0.9 ? <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300"><TriangleAlert className="size-3.5" />{t("notifHealth.lowRate")}</p> : null}
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>{t("notifHealth.byCategory")}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(data.by_category).map(([key, row]) => {
                    const total = Object.values(row).reduce((sum, value) => sum + value, 0);
                    return <div key={key} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm"><span className="font-medium">{categoryName(key)}</span><span className="text-xs text-muted-foreground">{formatNumber(total, locale)} · {t("notifHealth.delivered")} {formatNumber(row.delivered ?? 0, locale)} · {t("notifHealth.failed")} {formatNumber((row.failed ?? 0) + (row.dead ?? 0), locale)}</span></div>;
                  })}
                  {!Object.keys(data.by_category).length ? <p className="text-sm text-muted-foreground">{t("common.noData")}</p> : null}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>{t("notifHealth.devices")}</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between rounded-xl border px-3 py-2"><span>{t("notifHealth.devicesActive")}</span><b>{formatNumber(data.devices.active, locale)}</b></div>
                  <div className="flex justify-between rounded-xl border px-3 py-2"><span>{t("notifHealth.devicesDeactivated")}</span><b>{formatNumber(data.devices.deactivated, locale)}</b></div>
                  <div className="flex justify-between rounded-xl border px-3 py-2"><span>{t("notifHealth.inAppCreated")}</span><b>{formatNumber(data.in_app.created, locale)}</b></div>
                  <div className="flex justify-between rounded-xl border px-3 py-2"><span>{t("notifHealth.inAppUnread")}</span><b>{formatNumber(data.in_app.unread, locale)}</b></div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle>{t("notifHealth.failures")}</CardTitle><CardDescription>{t("notifHealth.failuresHint")}</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {data.top_errors.length ? <div className="flex flex-wrap gap-2">{data.top_errors.map((item) => <span key={item.error_code} className="rounded-full border px-3 py-1 text-xs"><Ltr as="span" className="font-mono">{item.error_code}</Ltr> · {formatNumber(item.n, locale)}</span>)}</div> : <p className="text-sm text-muted-foreground">{t("notifHealth.noFailures")}</p>}
                {data.recent_failures.map((row) => (
                  <div key={row.id} className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs"><span>{row.category ? categoryName(row.category) : "—"} · <Ltr as="span" className="font-mono">{row.error_code || row.status}</Ltr></span><span className="text-muted-foreground">{formatDate(row.created_at, locale)}</span></div>
                ))}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </CapabilityGate>
  );
}
