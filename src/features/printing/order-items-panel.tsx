"use client";

import { Boxes, CheckCircle2, FileText, MapPin, PackageCheck } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Money } from "@/components/shared/money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintOrderPreview } from "@/features/printing/print-order-preview";
import { countLabel, parseOrderItems, prepProgress, summarizePrep } from "@/features/printing/print-order-rules";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "panorama.print.prep.";

/** The ticked items live in this browser only: a convenience for the cashier, never sent to the server. */
function loadDone(orderId: number): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${orderId}`);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
  } catch {
    return new Set();
  }
}

function saveDone(orderId: number, done: Set<string>) {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${orderId}`, JSON.stringify([...done]));
  } catch {
    /* private window or blocked storage: the tick simply is not remembered */
  }
}

interface Pickup { name?: string; address?: string; instructions?: string }

export function OrderItemsPanel({ orderId, items: rawItems, currency, pickup }: { orderId: number; items: unknown; currency: string; pickup?: Pickup | null }) {
  const { t, enumLabel, locale } = useI18n();
  const items = useMemo(() => parseOrderItems(rawItems), [rawItems]);
  const prep = useMemo(() => summarizePrep(items), [items]);
  // Mounted per order (see the `key` at the call site) and only after the cashier opens it, so reading storage here is safe.
  const [done, setDone] = useState<Set<string>>(() => loadDone(orderId));

  const toggle = useCallback((id: string) => {
    setDone((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveDone(orderId, next);
      return next;
    });
  }, [orderId]);

  const progress = prepProgress(items, done);
  const complete = progress.total > 0 && progress.done === progress.total;

  if (!items.length) return <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">{t("printing.noItems")}</CardContent></Card>;

  return (
    <div className="space-y-4">
      <Card className={cn(complete && "border-emerald-500/40")}>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base"><Boxes className="size-4 text-primary" />{t("printing.prepTitle")}</CardTitle>
            <span className={cn("rounded-full border px-3 py-1 text-xs font-bold", complete ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}>
              {complete ? <CheckCircle2 className="me-1 inline size-3.5" /> : null}{t("printing.prepProgress", { done: progress.done, total: progress.total })}
            </span>
          </div>
          <CardDescription>{t("printing.prepHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">{t("printing.prepPaperTitle")}</p>
            {prep.paper.length ? <ul className="space-y-1.5 text-sm">{prep.paper.map((need) => (
              <li key={`${need.paperSize}-${need.colorMode}`} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
                <span>{need.paperSize} · {enumLabel(need.colorMode)}</span>
                <bdi className="font-bold">{countLabel(locale, need.sheets, "sheets")}</bdi>
              </li>
            ))}</ul> : <p className="text-sm text-muted-foreground">—</p>}
            {prep.incomplete ? <p className="text-xs text-amber-700 dark:text-amber-300">{t("printing.prepIncomplete")}</p> : null}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">{t("printing.prepBindingTitle")}</p>
            {prep.bindings.length ? <ul className="space-y-1.5 text-sm">{prep.bindings.map((need) => (
              <li key={need.binding} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
                <span>{enumLabel(need.binding)}</span>
                <bdi className="font-bold">{countLabel(locale, need.units, "bound")}</bdi>
              </li>
            ))}</ul> : <p className="text-sm text-muted-foreground">{t("printing.prepNoBinding")}</p>}
          </div>
          {pickup?.name ? (
            <div className="flex items-start gap-2 rounded-lg border p-3 text-sm sm:col-span-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <div><p className="font-semibold">{t("printing.pickupPoint")}: {pickup.name}</p>{pickup.address ? <p className="text-muted-foreground">{pickup.address}</p> : null}{pickup.instructions ? <p className="text-muted-foreground">{pickup.instructions}</p> : null}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-base font-bold"><PackageCheck className="size-4 text-primary" />{t("printing.itemsTitle")} <span className="text-sm font-normal text-muted-foreground">({items.length})</span></h3>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item, index) => {
          const id = String(item.id);
          const ticked = done.has(id);
          return (
            <Card key={id} className={cn("overflow-hidden transition-colors", ticked && "border-emerald-500/40 bg-emerald-500/5")}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">{t("printing.itemLabel", { number: index + 1 })}</p>
                    <p className="break-words font-semibold" dir="auto">{item.fileName || t("printing.unnamedFile")}</p>
                  </div>
                  {item.price !== null ? <Money value={item.price} currency={currency} /> : null}
                </div>
                <PrintOrderPreview item={item} pages={item.pages} />
                <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                  {[[t("printing.copies"), item.copies], [t("printing.pages"), item.pages ?? "—"], [t("printing.sheets"), item.sheets ?? "—"]].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg bg-muted/40 py-2"><dt className="text-muted-foreground">{label}</dt><dd className="mt-0.5 text-sm font-bold"><bdi>{value}</bdi></dd></div>
                  ))}
                </dl>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                  <input type="checkbox" className="size-4 accent-emerald-600" checked={ticked} onChange={() => toggle(id)} />
                  {t("printing.markPrepared")}
                </label>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
