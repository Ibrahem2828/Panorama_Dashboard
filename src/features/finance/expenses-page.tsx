"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import type { ResourceColumn } from "@/components/data-grid/resource-table";
import { Money } from "@/components/shared/money";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { EXPENSE_CATEGORIES, FINANCE_CURRENCIES, FINANCE_PATHS, expenseTotals, formatDay, localIsoDate, parseSummary, periodQuery } from "@/features/finance/finance-rules";
import { ResourceManager, type ManagerFilter } from "@/features/resources/resource-manager";
import { useI18n } from "@/i18n/provider";
import { apiFetch, unwrap } from "@/lib/api/browser-client";
import { CAPABILITIES } from "@/lib/auth/capabilities";

/** Totals of the expenses that match the current filters (from the summary endpoint; no date means "all time"). */
function ExpenseTotals() {
  const { t, enumLabel } = useI18n();
  const params = useSearchParams();
  const category = params.get("category") ?? "";
  const currency = params.get("currency") ?? "";
  const from = params.get("from") || "2000-01-01";
  const to = params.get("to") || localIsoDate(new Date());
  const query = useQuery({
    queryKey: ["resource", "finance-expenses", "totals", from, to],
    enabled: from <= to,
    queryFn: async () => parseSummary(await unwrap(apiFetch(`${FINANCE_PATHS.summary}?${periodQuery({ from, to })}`))),
  });
  const rows = query.data ? expenseTotals(query.data, category, currency) : [];
  return (
    <section aria-label={t("finance.expenses.totals")} className="grid gap-3 sm:grid-cols-2">
      {rows.length ? rows.map((row) => (
        <Card key={row.currency}>
          <CardHeader className="pb-2"><CardDescription>{t("finance.expenses.totals")} · {enumLabel(row.currency)}</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-black"><Money value={row.total} currency={row.currency} /></p></CardContent>
        </Card>
      )) : query.data ? <p className="text-sm text-muted-foreground">{t("finance.expenses.noTotals")}</p> : null}
    </section>
  );
}

/** المصروفات: CRUD table filtered by category, currency and date range, with totals. */
export function ExpensesPage() {
  const { t, enumLabel, locale } = useI18n();
  const columns = useMemo<ResourceColumn[]>(() => [
    { key: "id", label: "#" },
    { key: "spent_on", render: (value) => formatDay(value, locale) },
    { key: "category", render: (value) => enumLabel(value) },
    { key: "description" },
    { key: "amount", render: (value, row) => <Money value={value} currency={row.currency} /> },
    { key: "currency", render: (value) => enumLabel(value) },
  ], [enumLabel, locale]);
  const filters = useMemo<ManagerFilter[]>(() => [
    { param: "category", label: t("finance.expenses.category"), options: EXPENSE_CATEGORIES.map((value) => ({ value, label: enumLabel(value) })) },
    { param: "currency", label: t("finance.expenses.currency"), options: FINANCE_CURRENCIES.map((value) => ({ value, label: enumLabel(value) })) },
    { param: "from", label: t("finance.expenses.from"), kind: "date" },
    { param: "to", label: t("finance.expenses.to"), kind: "date" },
  ], [t, enumLabel]);
  return (
    <ResourceManager
      resourceKey="finance-expenses"
      title={t("finance.expenses.title")}
      description={t("finance.expenses.subtitle")}
      eyebrow={t("nav.finance")}
      capability={CAPABILITIES.finance}
      columns={columns}
      filters={filters}
      createLabel={t("finance.expenses.add")}
      extraContent={<ExpenseTotals />}
    />
  );
}
