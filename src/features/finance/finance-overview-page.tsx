"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeftRight, PackageX, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/config/constants";
import {
  FINANCE_CURRENCIES, FINANCE_PATHS, formatQuantity, formatRate, hasAmounts, missingRateForTotals, parseSummary, periodQuery,
  type FinanceCurrency, type FinanceSummary,
} from "@/features/finance/finance-rules";
import { PeriodFilter, usePeriod } from "@/features/finance/period-filter";
import { useI18n } from "@/i18n/provider";
import { localizePath } from "@/i18n/routing";
import { apiFetch, unwrap } from "@/lib/api/browser-client";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { formatNumber } from "@/lib/utils";

type Bucket = Partial<Record<FinanceCurrency, string>>;

/** The per-currency parts of a total ("1,000 ل.س · $5.00"), shown under the converted figure. */
function Breakdown({ bucket }: { bucket: Bucket }) {
  const parts = FINANCE_CURRENCIES.filter((currency) => bucket[currency] !== undefined);
  if (!parts.length) return null;
  return (
    <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
      {parts.map((currency) => <Money key={currency} value={bucket[currency]} currency={currency} />)}
    </p>
  );
}

function StatCard({ label, total, currency, bucket, tone }: { label: string; total: string | null; currency: FinanceCurrency; bucket?: Bucket; tone?: "good" | "bad" }) {
  const { t } = useI18n();
  const negative = total !== null && Number(total) < 0;
  return (
    <Card>
      <CardHeader className="pb-2"><CardDescription>{label}</CardDescription></CardHeader>
      <CardContent>
        {total === null ? (
          <p className="text-2xl font-black text-muted-foreground" title={t("finance.overview.noConversion")}>—</p>
        ) : (
          <p className={`text-2xl font-black ${negative || tone === "bad" ? "text-destructive" : tone === "good" ? "text-emerald-600 dark:text-emerald-400" : ""}`}><Money value={total} currency={currency} /></p>
        )}
        {bucket ? <Breakdown bucket={bucket} /> : null}
      </CardContent>
    </Card>
  );
}

function SummaryBody({ summary, currency }: { summary: FinanceSummary; currency: FinanceCurrency }) {
  const { t, enumLabel, locale } = useI18n();
  const params = useParams<{ locale: Locale }>();
  const noRate = missingRateForTotals(summary);
  const categoryRows = summary.expensesByCategory.filter((row) => hasAmounts(row.amounts));
  return (
    <div className="space-y-6">
      {noRate ? (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 leading-7"><AlertTriangle className="mt-1 size-4 shrink-0 text-amber-600" />{t("finance.overview.noRateNotice")}</p>
          <Button asChild variant="outline" size="sm"><Link href={localizePath(params.locale, "/dashboard/finance/rates")}><ArrowLeftRight />{t("finance.overview.noRateLink")}</Link></Button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label={t("finance.overview.revenue")} total={summary.totals.revenue} currency={currency} bucket={summary.revenue} />
        <StatCard label={t("finance.overview.collected")} total={summary.totals.collected} currency={currency} bucket={summary.collected} tone="good" />
        <StatCard label={t("finance.overview.outstanding")} total={summary.totals.outstanding} currency={currency} />
        <StatCard label={t("finance.overview.expenses")} total={summary.totals.expenses} currency={currency} bucket={summary.expenses} />
        <StatCard label={t("finance.overview.net")} total={summary.totals.net} currency={currency} tone={summary.totals.net !== null && Number(summary.totals.net) > 0 ? "good" : undefined} />
        <StatCard label={t("finance.overview.stockValue")} total={summary.totals.stockValue} currency={currency} bucket={summary.stockValue} />
      </div>

      <p className="text-sm text-muted-foreground">
        {summary.exchangeRate
          ? t("finance.overview.rateUsed", { rate: formatRate(summary.exchangeRate.sypPerUsd, locale) })
          : t("finance.overview.rateNone")}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("finance.overview.perCurrency")}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-start text-xs text-muted-foreground"><th className="p-2 text-start font-semibold">{t("finance.overview.item")}</th>{FINANCE_CURRENCIES.map((code) => <th key={code} className="p-2 text-start font-semibold">{enumLabel(code)}</th>)}</tr></thead>
              <tbody>
                {([
                  ["finance.overview.revenue", summary.revenue],
                  ["finance.overview.collected", summary.collected],
                  ["finance.overview.expenses", summary.expenses],
                  ["finance.overview.stockValue", summary.stockValue],
                ] as const).map(([label, bucket]) => (
                  <tr key={label} className="border-t">
                    <td className="p-2 font-medium">{t(label)}</td>
                    {FINANCE_CURRENCIES.map((code) => <td key={code} className="p-2"><Money value={bucket[code] ?? "0"} currency={code} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                ["finance.overview.orders", summary.ordersCount],
                ["finance.overview.files", summary.filesCount],
                ["finance.overview.pages", summary.pagesCount],
                ["finance.overview.sheets", summary.sheetsCount],
              ] as const).map(([label, value]) => (
                <div key={label} className="rounded-xl border bg-muted/30 p-3"><dt className="text-[11px] font-bold text-muted-foreground">{t(label)}</dt><dd className="mt-1 text-lg font-black tabular-nums">{formatNumber(value, "en")}</dd></div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("finance.overview.byCategory")}</CardTitle></CardHeader>
          <CardContent>
            {categoryRows.length ? (
              <ul className="divide-y">
                {categoryRows.map((row) => (
                  <li key={row.category} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="font-medium">{enumLabel(row.category)}</span>
                    <span className="flex flex-wrap justify-end gap-x-3">{FINANCE_CURRENCIES.filter((code) => row.amounts[code] !== undefined).map((code) => <Money key={code} value={row.amounts[code]} currency={code} />)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">{t("finance.overview.noExpenses")}</p>}
          </CardContent>
        </Card>
      </div>

      <Card className={summary.lowStock.length ? "border-amber-500/40" : undefined}>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><PackageX className="size-4 text-amber-600" />{t("finance.overview.lowStock")}</CardTitle></CardHeader>
        <CardContent>
          {summary.lowStock.length ? (
            <ul className="divide-y">
              {summary.lowStock.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span><span className="font-semibold">{item.name}</span><span className="ms-2 text-xs text-muted-foreground">{enumLabel(item.category)}</span></span>
                  <span className="text-muted-foreground">{t("finance.overview.lowStockLine", { quantity: formatQuantity(item.quantity, locale), unit: item.unit, level: formatQuantity(item.reorderLevel, locale) })}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">{t("finance.overview.noLowStock")}</p>}
          {summary.lowStock.length ? <Button asChild variant="outline" size="sm" className="mt-3"><Link href={localizePath(params.locale, "/dashboard/finance/stock")}>{t("finance.overview.openStock")}</Link></Button> : null}
        </CardContent>
      </Card>
    </div>
  );
}

/** نظرة مالية: period + reporting currency, totals converted with the current rate, per-currency breakdown, expenses and low stock. */
export function FinanceOverviewPage() {
  const { t, enumLabel } = useI18n();
  const period = usePeriod("month");
  const [currency, setCurrency] = useState<FinanceCurrency>("SYP");
  const usable = period.preset !== "custom" || period.problem === null;
  const query = useQuery({
    queryKey: ["finance-summary", period.range.from, period.range.to, currency],
    enabled: usable,
    queryFn: async () => parseSummary(await unwrap(apiFetch(`${FINANCE_PATHS.summary}?${periodQuery(period.range, { currency })}`))),
  });
  return (
    <CapabilityGate capability={CAPABILITIES.finance}>
      <div className="space-y-6">
        <PageHeader
          title={t("finance.overview.title")}
          description={t("finance.overview.subtitle")}
          eyebrow={t("nav.finance")}
          actions={<Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching || !usable}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />{t("common.refresh")}</Button>}
        />
        <div className="glass-panel flex flex-col gap-3 rounded-2xl border p-3 sm:p-4 lg:flex-row lg:items-end lg:justify-between">
          <PeriodFilter period={period} />
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t("finance.overview.reportCurrency")}</p>
            <div role="group" aria-label={t("finance.overview.reportCurrency")} className="inline-flex rounded-lg border bg-muted/40 p-1">
              {FINANCE_CURRENCIES.map((code) => (
                <Button key={code} type="button" size="sm" variant={currency === code ? "default" : "ghost"} aria-pressed={currency === code} onClick={() => setCurrency(code)}>{enumLabel(code)}</Button>
              ))}
            </div>
          </div>
        </div>
        {!usable ? <p className="text-sm text-muted-foreground">{t("finance.period.pick")}</p> : query.isPending ? (
          <div className="space-y-3"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>
        ) : query.isError ? <ErrorPanel error={query.error} retry={() => void query.refetch()} /> : <SummaryBody summary={query.data} currency={currency} />}
      </div>
    </CapabilityGate>
  );
}
