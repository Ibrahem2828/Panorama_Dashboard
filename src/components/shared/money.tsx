"use client";

import { useI18n } from "@/i18n/provider";
import { formatMoney } from "@/features/finance/finance-rules";
import { cn } from "@/lib/utils";

/** An amount with its currency ("1,250 ل.س" / "$12.50"): Western digits, grouping, isolated from the surrounding bidi text. */
export function Money({ value, currency, className }: { value: unknown; currency: unknown; className?: string }) {
  const { locale } = useI18n();
  return <bdi className={cn("whitespace-nowrap tabular-nums", className)}>{formatMoney(value, currency, locale)}</bdi>;
}
