"use client";

import { Layers } from "lucide-react";

import { formatMoney } from "@/features/finance/finance-rules";
import { priceUnitLabelKey, sectionLabelKey, type ItemExtra } from "@/features/printing/paper-options-rules";
import { useI18n } from "@/i18n/provider";

/** The paper options chosen on an order item (section, name, unit price and what it adds), read from the pricing snapshot. */
export function ItemExtrasList({ extras, total, currency }: { extras: readonly ItemExtra[]; total: string | null; currency: string }) {
  const { t, locale } = useI18n();
  if (!extras.length) return null;
  return (
    <div className="space-y-1.5 rounded-lg border p-2.5 text-xs">
      <p className="flex items-center gap-1.5 font-bold"><Layers className="size-3.5 text-primary" aria-hidden="true" />{t("counter.extras.title")}</p>
      <ul className="space-y-1">
        {extras.map((extra) => (
          <li key={extra.section} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="min-w-0">
              <span className="text-muted-foreground">{t(sectionLabelKey(extra.section))}: </span>
              <span className="break-words font-semibold" dir="auto">{extra.name}</span>
            </span>
            <span className="text-muted-foreground">
              {extra.price !== null && extra.priceUnit ? <bdi>{formatMoney(extra.price, currency, locale)} · {t(priceUnitLabelKey(extra.priceUnit))}</bdi> : null}
              {extra.cost !== null ? <bdi className="ms-2 font-bold text-foreground">{formatMoney(extra.cost, currency, locale)}</bdi> : null}
            </span>
          </li>
        ))}
      </ul>
      {total !== null ? <p className="border-t pt-1.5 font-bold">{t("counter.extrasPrice", { price: formatMoney(total, currency, locale) })}</p> : null}
    </div>
  );
}
