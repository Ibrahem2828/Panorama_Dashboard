"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FINANCE_CURRENCIES, INVENTORY_CATEGORIES, STOCK_REPORT_PATH, barShares, formatQuantity, formatRate, isFutureMonth, monthOf, parseStockReport, shiftMonth,
  stockCover, stockReportCsv, type StockCoverState, type StockReport, type StockReportRow,
} from "@/features/finance/finance-rules";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages";
import { apiFetch, unwrap } from "@/lib/api/browser-client";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { cn, formatNumber } from "@/lib/utils";

const COVER_STYLE: Record<StockCoverState, string> = {
  out: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  critical: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  soon: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  unknown: "text-muted-foreground",
};

function groupRows(rows: readonly StockReportRow[]): { category: string; rows: StockReportRow[] }[] {
  const order = [...INVENTORY_CATEGORIES] as string[];
  const groups = new Map<string, StockReportRow[]>();
  for (const row of rows) groups.set(row.category, [...(groups.get(row.category) ?? []), row]);
  return [...groups.entries()]
    .sort(([a], [b]) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)))
    .map(([category, list]) => ({ category, rows: list }));
}

function Stat({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-2xl">{children}</CardTitle></CardHeader>
      {hint ? <CardContent className="pt-0 text-xs text-muted-foreground">{hint}</CardContent> : null}
    </Card>
  );
}

function CoverChip({ row }: { row: StockReportRow }) {
  const { t } = useI18n();
  const state = stockCover(row);
  const label = state === "out" ? t("stockReport.cover.out") : state === "unknown" ? t("stockReport.cover.unknown") : t("stockReport.cover.days", { count: formatNumber(row.daysLeft ?? 0, "en") });
  return <Badge variant="outline" className={cn("whitespace-nowrap rounded-full font-semibold", COVER_STYLE[state])}>{label}</Badge>;
}

function ReportTable({ report, rows, category }: { report: StockReport; rows: StockReportRow[]; category: string }) {
  const { t, enumLabel, locale } = useI18n();
  const bars = barShares(rows);
  const q = (value: string) => formatQuantity(value, locale);
  return (
    <section aria-label={enumLabel(category)} className="space-y-2">
      <h2 className="text-sm font-black text-muted-foreground">{enumLabel(category)}</h2>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            <thead className="bg-muted/55 text-xs text-muted-foreground">
              <tr>
                {(["item", "opening", "purchased", "used", "waste", "adjustment", "closing", "daily", "cover", "suggested"] as const).map((key) => (
                  <th key={key} scope="col" className="whitespace-nowrap p-3 text-start font-bold">{t(`stockReport.col.${key}` as "stockReport.col.item")}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const bar = bars[index] ?? { purchased: 0, used: 0 };
                const state = stockCover(row);
                return (
                  <tr key={row.id} className="border-t align-top hover:bg-muted/30">
                    <td className="min-w-[13rem] p-3">
                      <p className="break-words font-semibold" dir="auto">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.unit}</p>
                      <div className="mt-2 space-y-1" aria-hidden="true">
                        <div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${bar.purchased}%` }} /></div>
                        <div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-amber-500" style={{ width: `${bar.used}%` }} /></div>
                      </div>
                    </td>
                    <td className="p-3 tabular-nums">{q(row.opening)}</td>
                    <td className="p-3">
                      <span className="font-bold tabular-nums">{q(row.purchased)}</span>
                      {FINANCE_CURRENCIES.map((currency) => (row.purchaseCost[currency] ? <span key={currency} className="block text-xs text-muted-foreground"><Money value={row.purchaseCost[currency]} currency={currency} /></span> : null))}
                    </td>
                    <td className="p-3">
                      <span className="font-bold tabular-nums">{q(row.used)}</span>
                      {Number(row.used) > 0 ? <span className="block text-xs text-muted-foreground"><bdi>{t("stockReport.usedSplit", { orders: q(row.usedByOrders), hand: q(row.usedByHand) })}</bdi></span> : null}
                    </td>
                    <td className="p-3 tabular-nums">
                      {q(row.waste)}
                      {Object.keys(row.wasteByReason).length > 0 ? (
                        <span className="block text-xs text-muted-foreground">{Object.entries(row.wasteByReason).map(([reason, amount]) => `${t(`finance.waste.${reason}` as MessageKey)}: ${q(amount)}`).join(" · ")}</span>
                      ) : null}
                    </td>
                    <td className="p-3 tabular-nums"><bdi dir="ltr">{Number(row.adjustment) > 0 ? "+" : ""}{q(row.adjustment)}</bdi></td>
                    <td className="p-3"><span className={cn("font-bold tabular-nums", state === "out" && "text-red-600 dark:text-red-400")}>{q(row.closing)}</span>{row.isLow ? <Badge variant="warning" className="ms-2 whitespace-nowrap">{t("finance.stock.low")}</Badge> : null}</td>
                    <td className="p-3 tabular-nums">{row.dailyUsage === null ? "—" : <bdi>{formatRate(row.dailyUsage, locale)}</bdi>}</td>
                    <td className="p-3"><CoverChip row={row} /></td>
                    <td className="p-3 tabular-nums">{row.suggestedPurchase === null ? "—" : Number(row.suggestedPurchase) > 0 ? <span className="font-bold text-primary"><bdi>{q(row.suggestedPurchase)}</bdi></span> : <span className="text-muted-foreground">{t("stockReport.noPurchase")}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("stockReport.legend", { days: report.coverDays })}</p>
    </section>
  );
}

export function StockReportPage() {
  const { t } = useI18n();
  const [month, setMonth] = useState(() => monthOf(new Date()));
  const current = monthOf(new Date());
  const query = useQuery({
    queryKey: ["finance-stock-report", month],
    queryFn: async () => parseStockReport(await unwrap(apiFetch(`${STOCK_REPORT_PATH}?month=${encodeURIComponent(month)}`))),
  });
  const report = query.data ?? null;
  const groups = useMemo(() => (report ? groupRows(report.rows) : []), [report]);

  const go = (delta: number) => {
    const next = shiftMonth(month, delta);
    if (next && !isFutureMonth(next)) setMonth(next);
  };
  const exportCsv = () => {
    if (!report) return;
    const labels = (["item", "unit", "opening", "purchased", "used", "usedByOrders", "usedByHand", "waste", "adjustment", "closing", "daily", "cover", "suggested"] as const).map((key) => t(`stockReport.csv.${key}` as "stockReport.csv.item"));
    const blob = new Blob([stockReportCsv(report.rows, labels)], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `stock-report-${report.month}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <CapabilityGate capability={CAPABILITIES.finance}>
      <div className="space-y-6">
        <PageHeader title={t("stockReport.title")} description={t("stockReport.subtitle")} eyebrow={t("nav.finance")}
          actions={<Button variant="outline" onClick={exportCsv} disabled={!report?.rows.length}><Download />{t("stockReport.export")}</Button>} />

        <div className="glass-panel flex flex-wrap items-center gap-2 rounded-2xl border p-3">
          <Button type="button" variant="outline" size="icon" className="size-10" aria-label={t("stockReport.prev")} onClick={() => go(-1)}><ChevronRight className="rtl:rotate-0 ltr:rotate-180" /></Button>
          <Input type="month" dir="ltr" className="h-10 w-44 text-center font-bold" aria-label={t("stockReport.month")} value={month} max={current}
            onChange={(event) => { if (/^\d{4}-\d{2}$/u.test(event.target.value) && !isFutureMonth(event.target.value)) setMonth(event.target.value); }} />
          <Button type="button" variant="outline" size="icon" className="size-10" aria-label={t("stockReport.next")} disabled={month >= current} onClick={() => go(1)}><ChevronLeft className="rtl:rotate-0 ltr:rotate-180" /></Button>
          {month !== current ? <Button type="button" variant="ghost" onClick={() => setMonth(current)}>{t("stockReport.thisMonth")}</Button> : null}
          <Button type="button" variant="ghost" className="ms-auto" onClick={() => void query.refetch()}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />{t("common.refresh")}</Button>
        </div>

        {query.isPending ? <Skeleton className="h-96 rounded-2xl" /> : query.isError ? <ErrorPanel error={query.error} retry={() => void query.refetch()} /> : !report ? (
          <p className="rounded-2xl border p-10 text-center text-muted-foreground">{t("common.noData")}</p>
        ) : (
          <>
            <section aria-label={t("stockReport.summary")} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label={t("stockReport.purchaseCost")} hint={t("stockReport.purchaseCostHint")}>
                {FINANCE_CURRENCIES.some((currency) => report.purchaseCost[currency]) ? (
                  <span className="flex flex-col gap-0.5 text-xl">{FINANCE_CURRENCIES.map((currency) => (report.purchaseCost[currency] ? <Money key={currency} value={report.purchaseCost[currency]} currency={currency} /> : null))}</span>
                ) : <span className="text-muted-foreground">—</span>}
              </Stat>
              <Stat label={t("stockReport.orders")}><bdi>{formatNumber(report.ordersDelivered, "en")}</bdi></Stat>
              <Stat label={t("stockReport.sheets")}><bdi>{formatNumber(report.sheetsPrinted, "en")}</bdi></Stat>
              <Stat label={t("stockReport.needReorder")}><bdi className={report.itemsLow ? "text-amber-700 dark:text-amber-300" : undefined}>{formatNumber(report.itemsLow, "en")}</bdi></Stat>
            </section>
            <p className="text-xs leading-6 text-muted-foreground">{report.daysElapsed < 3 ? t("stockReport.tooEarly", { days: report.daysElapsed }) : t("stockReport.basis", { days: report.daysElapsed })}</p>
            {groups.length ? groups.map((group) => <ReportTable key={group.category} report={report} rows={group.rows} category={group.category} />) : <p className="rounded-2xl border p-10 text-center text-muted-foreground">{t("stockReport.empty")}</p>}
          </>
        )}
      </div>
    </CapabilityGate>
  );
}
