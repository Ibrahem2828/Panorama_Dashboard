"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { ResourceColumn } from "@/components/data-grid/resource-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { FINANCE_PATHS, currentExchangeRate, formatDay, formatRate, type RateRow } from "@/features/finance/finance-rules";
import { fetchAllPages } from "@/components/forms/contract-field";
import { ResourceManager } from "@/features/resources/resource-manager";
import { useI18n } from "@/i18n/provider";
import { CAPABILITIES } from "@/lib/auth/capabilities";

/** أسعار الصرف: CRUD table; the latest rate in force is highlighted as the current one. */
export function RatesPage() {
  const { t, locale } = useI18n();
  const all = useQuery({
    queryKey: ["resource", "finance-exchange-rates", "all"],
    queryFn: () => fetchAllPages(FINANCE_PATHS.rates),
  });
  const current = useMemo(() => (all.data ? currentExchangeRate(all.data as RateRow[]) : null), [all.data]);
  const columns = useMemo<ResourceColumn[]>(() => [
    { key: "id", label: "#" },
    { key: "effective_from", render: (value, row) => (
      <span className="flex flex-wrap items-center gap-2">
        <span>{formatDay(value ?? row.created_at, locale)}</span>
        {current && row.id === current.id ? <Badge variant="success" className="rounded-full">{t("finance.rates.current")}</Badge> : null}
      </span>
    ) },
    { key: "syp_per_usd", render: (value, row) => <bdi className={`tabular-nums ${current && row.id === current.id ? "font-black" : ""}`}>{formatRate(value, locale)}</bdi> },
    { key: "note" },
  ], [current, locale, t]);
  return (
    <ResourceManager
      resourceKey="finance-exchange-rates"
      title={t("finance.rates.title")}
      description={t("finance.rates.subtitle")}
      eyebrow={t("nav.finance")}
      capability={CAPABILITIES.finance}
      columns={columns}
      createLabel={t("finance.rates.add")}
      extraContent={
        <Card className={current ? "border-emerald-500/40" : "border-amber-500/40"}>
          <CardHeader className="pb-2"><CardDescription>{t("finance.rates.currentCard")}</CardDescription></CardHeader>
          <CardContent>
            {current
              ? <p className="text-lg font-black">{t("finance.rates.currentLine", { rate: formatRate(current.syp_per_usd, locale), date: formatDay(current.effective_from ?? current.created_at, locale) })}</p>
              : all.isPending ? null : <p className="text-sm text-amber-700 dark:text-amber-300">{t("finance.rates.none")}</p>}
          </CardContent>
        </Card>
      }
    />
  );
}
