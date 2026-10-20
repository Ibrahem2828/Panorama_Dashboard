"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, PackageX } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Locale } from "@/config/constants";
import { LOW_STOCK_PATH, formatQuantity, isOutOfStock, newlyLow, sortLowStock, type LowStockItem } from "@/features/finance/finance-rules";
import { useCan } from "@/features/session";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { cn } from "@/lib/utils";

/**
 * The items at or under their reorder level, kept fresh: it is refetched every minute, when the window regains focus, and
 * whenever a stock query is invalidated (a movement, a delivered order, a purchase), because its key starts with "finance-stock".
 */
export function useLowStockState(): { items: LowStockItem[]; ready: boolean } {
  const allowed = useCan(CAPABILITIES.printing);
  const query = useQuery({
    queryKey: ["finance-stock", "low-stock"],
    enabled: allowed,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => sortLowStock((await normalizeCollection<LowStockItem>(await apiFetch(LOW_STOCK_PATH))).results),
  });
  return { items: allowed ? (query.data ?? EMPTY) : EMPTY, ready: allowed && query.isSuccess };
}

const EMPTY: LowStockItem[] = [];

export function useLowStock(): LowStockItem[] {
  return useLowStockState().items;
}

/** The number on the sidebar badge. */
export function useLowStockCount(): number {
  return useLowStock().length;
}

/**
 * The strip under the top bar while anything is low, plus an immediate pop-up when an item newly crosses its level while
 * the dashboard is open (for example the delivery that just took the last ream). It stays quiet on the stock page itself,
 * where the rows already show the state.
 */
export function LowStockBanner() {
  const { t, locale } = useI18n();
  const params = useParams<{ locale: Locale }>();
  const pathname = usePathname();
  const { items, ready } = useLowStockState();
  const previous = useRef<Set<number> | null>(null);

  useEffect(() => {
    // The first real answer only seeds the comparison: what is already low is on the strip, not a news flash.
    if (!ready) return;
    const announce = newlyLow(previous.current, items);
    previous.current = new Set(items.map((item) => item.id));
    for (const item of announce) {
      const out = isOutOfStock(item);
      toast.warning(out ? t("lowStock.toastOut", { name: item.name }) : t("lowStock.toastLow", { name: item.name }), {
        description: t("lowStock.toastBody", { quantity: formatQuantity(item.quantity, locale), unit: item.unit, level: formatQuantity(item.reorder_level, locale) }),
        duration: 12_000,
        id: `low-stock-${item.id}`,
      });
    }
  }, [items, ready, locale, t]);

  if (!items.length || pathname.includes("/dashboard/finance/stock")) return null;
  const anyOut = items.some(isOutOfStock);
  const shown = items.slice(0, 4);
  return (
    <div role="status" className={cn("border-b px-3 py-2.5 sm:px-5 lg:px-7", anyOut ? "border-red-500/30 bg-red-500/10 text-red-950 dark:text-red-100" : "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100")}>
      <div className="mx-auto flex max-w-[var(--app-content-max-width)] flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {anyOut ? <PackageX className="size-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />}
        <p className="min-w-0 font-bold">{t("lowStock.summary", { count: items.length })}</p>
        <ul className="flex min-w-0 basis-full flex-wrap gap-2 sm:basis-0 sm:flex-1">
          {shown.map((item) => (
            <li key={item.id} className={cn("max-w-full break-words rounded-full border px-2.5 py-0.5 text-xs font-semibold", isOutOfStock(item) ? "border-red-500/40 bg-red-500/10" : "border-amber-500/40 bg-amber-500/10")}>
              <bdi>{item.name}: {isOutOfStock(item) ? t("lowStock.out") : `${formatQuantity(item.quantity, locale)} ${item.unit}`}</bdi>
            </li>
          ))}
          {items.length > shown.length ? <li className="rounded-full px-2 py-0.5 text-xs font-semibold">{t("lowStock.more", { count: items.length - shown.length })}</li> : null}
        </ul>
        <Button asChild size="sm" variant="outline" className="shrink-0"><Link href={`/${params.locale ?? locale}/dashboard/finance/stock`}>{t("lowStock.open")}</Link></Button>
      </div>
    </div>
  );
}
