"use client";

import { useQuery } from "@tanstack/react-query";
import { Ban, BookMarked, CircleDot, Ellipsis, Minus, Notebook, Paperclip, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatMoney, type FinanceCurrency } from "@/features/finance/finance-rules";
import {
  BINDING_NOTE_MAX, COUNTER_BINDINGS, COUNTER_MAX_COPIES, COUNTER_MAX_PAGES, COUNTER_PAPERS, PAGES_PER_SHEET_CHOICES,
  lineProblems, lineSheets, pageRangeCount, wholeNumber, type CounterLine, type QuoteLine,
} from "@/features/printing/counter-order-rules";
import { PrintOrderPreview } from "@/features/printing/print-order-preview";
import { countLabel, type Binding } from "@/features/printing/print-order-rules";
import { Field, Segmented, type SegmentedOption } from "@/features/printing/segmented";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection, unwrap } from "@/lib/api/browser-client";
import { cn } from "@/lib/utils";

const BINDING_ICON: Record<string, ReactNode> = {
  none: <Ban className="size-4" />,
  staple: <Paperclip className="size-4" />,
  spiral: <Notebook className="size-4" />,
  beads: <CircleDot className="size-4" />,
  thermal: <BookMarked className="size-4" />,
  other: <Ellipsis className="size-4" />,
};

export function Stepper({ id, value, onChange, max, invalid, label }: { id: string; value: string; onChange: (next: string) => void; max: number; invalid: boolean; label: string }) {
  const number = wholeNumber(value, max);
  const step = (delta: number) => onChange(String(Math.min(max, Math.max(1, (number ?? 0) + delta))));
  return (
    <div className="flex items-stretch gap-2" dir="ltr">
      <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label={`${label} −`} onClick={() => step(-1)} disabled={number !== null && number <= 1}><Minus /></Button>
      <Input id={id} inputMode="numeric" className={cn("h-11 min-w-0 text-center text-base font-bold tabular-nums", invalid && "border-destructive focus-visible:ring-destructive")} value={value} onChange={(event) => onChange(event.target.value.replace(/\D/gu, "").slice(0, 3))} aria-invalid={invalid} />
      <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label={`${label} +`} onClick={() => step(1)} disabled={number !== null && number >= max}><Plus /></Button>
    </div>
  );
}

interface ShopProduct { id: number; name: string; price: string; currency: string }
interface ShopBinding { code: string; name: string }
interface ShopCover { code: string; name: string; price_per_copy: string }
interface ShopOptions { binding_types?: ShopBinding[]; covers?: ShopCover[]; pages_per_sheet?: number[] }

/** The shop's catalog as the app sees it: ready products, custom binding types, covers and the pages-per-sheet choices. */
export function useShopCatalog(currency: FinanceCurrency) {
  const products = useQuery({ queryKey: ["print-products-counter"], staleTime: 60_000, queryFn: async () => normalizeCollection<ShopProduct>(await apiFetch("/api/v1/printing/products/")) });
  const options = useQuery({ queryKey: ["print-options-counter", currency], staleTime: 60_000, queryFn: async () => unwrap(apiFetch<{ data: ShopOptions }>(`/api/v1/printing/options/?currency=${currency}`)) as Promise<ShopOptions> });
  const perSheet = (options.data?.pages_per_sheet ?? []).filter((value) => PAGES_PER_SHEET_CHOICES.includes(value));
  return {
    products: products.data?.results ?? [],
    bindings: options.data?.binding_types ?? [],
    covers: options.data?.covers ?? [],
    pagesPerSheet: perSheet.length ? perSheet : [...PAGES_PER_SHEET_CHOICES],
  };
}

const RANGE_MESSAGE = {
  format: "counter.range.format", order: "counter.range.order", beyond: "counter.range.beyond", empty: "counter.range.emptyRange", docPages: "counter.range.docPagesProblem",
} as const;

/** Works out the pages of one copy from the document's page count and a range such as "1-5, 8". */
function PageRangeHelper({ id, line, onChange }: { id: string; line: CounterLine; onChange: (patch: Partial<CounterLine>) => void }) {
  const { t } = useI18n();
  const total = wholeNumber(line.docPages, COUNTER_MAX_PAGES);
  const result = total === null ? null : pageRangeCount(line.pageRange, total);
  const count = result && "count" in result ? result.count : null;
  const message = result && "error" in result ? t(RANGE_MESSAGE[result.error], { pages: total ?? 0 }) : null;
  return (
    <details className="rounded-xl border bg-muted/20 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-semibold">{t("counter.range.title")}</summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Field label={t("counter.range.docPages")} htmlFor={`${id}-docpages`}>
          <Input id={`${id}-docpages`} className="h-11 text-center font-bold tabular-nums" dir="ltr" inputMode="numeric" value={line.docPages} onChange={(event) => onChange({ docPages: event.target.value.replace(/\D/gu, "").slice(0, 6) })} placeholder="0" />
        </Field>
        <Field label={t("counter.range.range")} htmlFor={`${id}-range`} hint={t("counter.range.hint")}>
          <Input id={`${id}-range`} className="h-11" dir="ltr" value={line.pageRange} maxLength={255} onChange={(event) => onChange({ pageRange: event.target.value.replace(/[^\d\s,;،\-–—]/gu, "") })} placeholder="1-5, 8" />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {message ? <p role="alert" className="text-xs font-medium text-destructive">{message}</p> : count !== null ? <p className="text-xs text-muted-foreground">{t("counter.range.result", { pages: count })}</p> : <p className="text-xs text-muted-foreground">{t("counter.range.empty")}</p>}
        <Button type="button" size="sm" variant="outline" disabled={count === null} onClick={() => count !== null && onChange({ pages: String(count) })}>{t("counter.range.apply")}</Button>
      </div>
    </details>
  );
}

export function LineCard({ line, index, canRemove, quoteLine, currency, showErrors, onChange, onRemove, autoFocusPages }: {
  line: CounterLine; index: number; canRemove: boolean; quoteLine?: QuoteLine; currency: FinanceCurrency; showErrors: boolean;
  onChange: (patch: Partial<CounterLine>) => void; onRemove?: () => void; autoFocusPages?: boolean;
}) {
  const { t, enumLabel, locale } = useI18n();
  const problems = lineProblems(line);
  const sheets = lineSheets(line);
  const colorOptions: SegmentedOption<CounterLine["colorMode"]>[] = (["black_white", "color"] as const).map((value) => ({ value, label: enumLabel(value) }));
  const sideOptions: SegmentedOption<CounterLine["sides"]>[] = (["one_sided", "double_sided"] as const).map((value) => ({ value, label: enumLabel(value) }));
  const paperOptions: SegmentedOption<CounterLine["paperSize"]>[] = COUNTER_PAPERS.map((value) => ({ value, label: value }));
  const bindingOptions: SegmentedOption<Binding>[] = COUNTER_BINDINGS.map((value) => ({ value, label: enumLabel(value), icon: BINDING_ICON[value] }));
  const id = `counter-${line.key}`;
  const catalog = useShopCatalog(currency);
  const custom = catalog.bindings.filter((type) => !COUNTER_BINDINGS.includes(type.code));
  const bindingChoices: SegmentedOption<Binding>[] = [...bindingOptions, ...custom.map((type) => ({ value: type.code, label: type.name || type.code, icon: <BookMarked className="size-4" /> }))];
  const perSheetOptions: SegmentedOption<string>[] = catalog.pagesPerSheet.map((value) => ({ value: String(value), label: String(value) }));
  const removeButton = canRemove && onRemove ? <Button type="button" variant="ghost" size="icon" className="size-10 text-destructive hover:text-destructive" aria-label={t("counter.removeItem", { number: index + 1 })} onClick={onRemove}><Trash2 /></Button> : null;

  if (line.productId !== null) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="text-base">{t("counter.itemN", { number: index + 1 })} · {t("counter.productLine")}</CardTitle>
          <div className="flex gap-1">
            <Button type="button" variant="outline" size="sm" onClick={() => onChange({ productId: null, productName: "", title: "" })}>{t("counter.productClear")}</Button>
            {removeButton}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="font-semibold" dir="auto">{line.productName}</p>
          <Field label={t("counter.copies")} htmlFor={`${id}-copies`} error={showErrors && problems.copies ? t("counter.copiesProblem", { max: COUNTER_MAX_COPIES }) : null}>
            <Stepper id={`${id}-copies`} value={line.copies} onChange={(copies) => onChange({ copies })} max={COUNTER_MAX_COPIES} invalid={showErrors && Boolean(problems.copies)} label={t("counter.copies")} />
          </Field>
          {quoteLine?.subtotal ? <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm font-bold">{t("counter.linePrice", { price: formatMoney(quoteLine.subtotal, currency, locale) })}</p> : null}
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="text-base">{t("counter.itemN", { number: index + 1 })}</CardTitle>
        {removeButton}
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-5">
          {catalog.products.length > 0 ? (
            <Field label={t("counter.productPick")} htmlFor={`${id}-product`} optional={t("counter.optional")}>
              <select id={`${id}-product`} className="h-11 w-full rounded-md border bg-background px-3 text-sm" value="" onChange={(event) => { const product = catalog.products.find((entry) => String(entry.id) === event.target.value); if (product) onChange({ productId: product.id, productName: product.name, title: product.name }); }}>
                <option value="">{t("counter.productNone")}</option>
                {catalog.products.map((product) => <option key={product.id} value={product.id}>{product.name} — {product.price} {product.currency}</option>)}
              </select>
            </Field>
          ) : null}
          <Field label={t("counter.itemTitle")} htmlFor={`${id}-title`} optional={t("counter.optional")}>
            <Input id={`${id}-title`} value={line.title} maxLength={255} onChange={(event) => onChange({ title: event.target.value })} placeholder={t("counter.itemTitlePlaceholder")} className="h-11" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("counter.pages")} htmlFor={`${id}-pages`} hint={t("counter.pagesHint")} error={showErrors && problems.pages ? t("counter.pagesProblem", { max: COUNTER_MAX_PAGES }) : null}>
              <Input id={`${id}-pages`} autoFocus={autoFocusPages} inputMode="numeric" dir="ltr" value={line.pages} onChange={(event) => onChange({ pages: event.target.value.replace(/\D/gu, "").slice(0, 6) })} aria-invalid={showErrors && Boolean(problems.pages)} className={cn("h-11 text-center text-base font-bold tabular-nums", showErrors && problems.pages && "border-destructive focus-visible:ring-destructive")} placeholder="0" />
            </Field>
            <Field label={t("counter.copies")} htmlFor={`${id}-copies`} error={showErrors && problems.copies ? t("counter.copiesProblem", { max: COUNTER_MAX_COPIES }) : null}>
              <Stepper id={`${id}-copies`} value={line.copies} onChange={(copies) => onChange({ copies })} max={COUNTER_MAX_COPIES} invalid={showErrors && Boolean(problems.copies)} label={t("counter.copies")} />
            </Field>
          </div>
          <PageRangeHelper id={id} line={line} onChange={onChange} />
          <Segmented label={t("counter.color")} value={line.colorMode} options={colorOptions} onChange={(colorMode) => onChange({ colorMode })} />
          <Segmented label={t("counter.sides")} value={line.sides} options={sideOptions} onChange={(sides) => onChange({ sides })} />
          <Segmented label={t("counter.paper")} value={line.paperSize} options={paperOptions} onChange={(paperSize) => onChange({ paperSize })} minItemRem={5} />
          <div className="space-y-1">
            <Segmented label={t("counter.perSheet")} value={String(line.pagesPerSheet)} options={perSheetOptions} onChange={(value) => onChange({ pagesPerSheet: Number(value) })} minItemRem={3.5} />
            <p className="text-xs text-muted-foreground">{t("counter.perSheetHint")}</p>
          </div>
          <Segmented label={t("counter.binding")} value={line.binding} options={bindingChoices} onChange={(binding) => onChange({ binding })} minItemRem={8} />
          {line.binding === "other" ? (
            <Field label={t("counter.bindingNote")} htmlFor={`${id}-note`} error={showErrors && problems.bindingNote ? t("counter.noteProblem") : null}>
              <Input id={`${id}-note`} value={line.bindingNote} maxLength={BINDING_NOTE_MAX} onChange={(event) => onChange({ bindingNote: event.target.value })} placeholder={t("counter.bindingNotePlaceholder")} className="h-11" aria-invalid={showErrors && Boolean(problems.bindingNote)} />
            </Field>
          ) : null}
          {catalog.covers.length > 0 ? (
            <Field label={t("counter.cover")} htmlFor={`${id}-cover`} optional={t("counter.optional")}>
              <select id={`${id}-cover`} className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={line.cover} onChange={(event) => onChange({ cover: event.target.value })}>
                <option value="">{t("counter.coverNone")}</option>
                {catalog.covers.map((cover) => <option key={cover.code} value={cover.code}>{cover.name} — {formatMoney(cover.price_per_copy, currency, locale)}</option>)}
              </select>
            </Field>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{sheets !== null ? t("counter.sheetsOfLine", { sheets: countLabel(locale, sheets, "sheets") }) : "—"}</span>
            {quoteLine?.subtotal ? <span className="font-bold">{t("counter.linePrice", { price: formatMoney(quoteLine.subtotal, currency, locale) })}</span> : null}
          </div>
          {quoteLine?.unavailable ? <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-800 dark:text-amber-200">{quoteLine.unavailable === "binding" ? t("counter.lineUnpricedBinding") : t("counter.lineUnpricedPricing")}</p> : null}
        </div>
        <div className="md:order-last">
          <PrintOrderPreview item={{ paperSize: line.paperSize, colorMode: line.colorMode, sides: line.sides, binding: line.binding, copies: wholeNumber(line.copies, COUNTER_MAX_COPIES) ?? 1 }} pages={wholeNumber(line.pages, COUNTER_MAX_PAGES)} />
          {line.binding === "other" && line.bindingNote.trim() ? <p className="mt-2 break-words rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground" dir="auto">{line.bindingNote.trim()}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
