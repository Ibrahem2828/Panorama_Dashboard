"use client";

import { Loader2, Printer } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Money } from "@/components/shared/money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FINANCE_CURRENCIES, type FinanceCurrency } from "@/features/finance/finance-rules";
import { LineCard } from "@/features/printing/counter-line-card";
import { newLine, signedRounding, type CounterLine } from "@/features/printing/counter-order-rules";
import { Segmented } from "@/features/printing/segmented";
import { useCounterQuote } from "@/features/printing/use-counter-quote";
import { useI18n } from "@/i18n/provider";

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={strong ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={strong ? "text-base font-black" : "font-semibold"}>{children}</span>
    </div>
  );
}

/** What-if pricing: choose the options, pages and copies and see what the price list charges. Nothing is saved. */
export function PricingSimulator() {
  const { t, enumLabel } = useI18n();
  const [line, setLine] = useState<CounterLine>(() => newLine());
  const [currency, setCurrency] = useState<FinanceCurrency>("SYP");
  const { allValid, quote, calculating, isError } = useCounterQuote([line], currency);
  const priced = quote?.lines[0];
  const rounding = signedRounding(quote?.rounding ?? null);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="min-w-0 space-y-4">
        <p className="text-sm text-muted-foreground">{t("simulator.intro")}</p>
        <Segmented label={t("counter.currency")} value={currency} options={FINANCE_CURRENCIES.map((value) => ({ value, label: enumLabel(value) }))} onChange={setCurrency} minItemRem={10} />
        <LineCard line={line} index={0} canRemove={false} quoteLine={priced} currency={currency} showErrors={false} onChange={(patch) => setLine((current) => ({ ...current, ...patch }))} />
      </div>
      <aside className="lg:sticky lg:top-4" aria-label={t("simulator.result")}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Printer className="size-4 text-primary" aria-hidden="true" />{t("simulator.result")}</CardTitle>
            <CardDescription>{t("simulator.notSaved")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm" aria-live="polite">
            {!allValid ? <p className="rounded-xl bg-muted/50 px-3 py-2 text-muted-foreground">{t("counter.fillLines")}</p>
              : isError ? <p role="alert" className="text-destructive">{t("counter.quoteFailed")}</p>
              : calculating && !quote ? <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t("counter.calculating")}</p>
              : quote && priced ? (
                <div className={calculating ? "space-y-2 opacity-60" : "space-y-2"}>
                  <Row label={t("simulator.sheets")}>{priced.sheets}</Row>
                  <Row label={t("simulator.unit")}>{priced.unitPrice ? <Money value={priced.unitPrice} currency={currency} /> : "—"}</Row>
                  <Row label={t("simulator.binding")}>{priced.bindingPrice ? <Money value={priced.bindingPrice} currency={currency} /> : "—"}</Row>
                  <div className="my-2 border-t" />
                  {quote.complete ? (
                    <>
                      <Row label={t("counter.exactTotal")}><Money value={quote.exactTotal} currency={currency} /></Row>
                      {rounding ? <Row label={t("counter.rounding")}><bdi dir="ltr" className="tabular-nums">{rounding}</bdi></Row> : null}
                      <Row label={t("counter.suggested")} strong><Money value={quote.suggestedTotal} currency={currency} /></Row>
                    </>
                  ) : <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-800 dark:text-amber-200">{t("simulator.unpriced")}</p>}
                </div>
              ) : null}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
