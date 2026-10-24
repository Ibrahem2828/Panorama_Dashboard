"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Ban, BookMarked, CheckCircle2, CircleDot, Ellipsis, Loader2, Minus, Notebook, Paperclip, Plus, Printer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FINANCE_CURRENCIES, PAYMENT_METHODS, dueAmount, formatMoney, type FinanceCurrency, type PaymentMethod } from "@/features/finance/finance-rules";
import {
  BINDING_NOTE_MAX, COUNTER_BINDINGS, COUNTER_MAX_COPIES, COUNTER_MAX_LINES, COUNTER_MAX_PAGES, COUNTER_PAPERS, COUNTER_PATHS, COUNTER_STATUSES,
  amountProblem, createBody, defaultPaid, lineProblems, lineSheets, newLine, orderIsReady, paidProblem, parseCounterQuote, quoteBody, signedRounding, wholeNumber,
  type CounterLine, type CounterQuote, type CounterStatus, type QuoteLine,
} from "@/features/printing/counter-order-rules";
import { PrintOrderPreview } from "@/features/printing/print-order-preview";
import { countLabel, type Binding } from "@/features/printing/print-order-rules";
import { Field, Segmented, type SegmentedOption } from "@/features/printing/segmented";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useIdempotencyKey, useMutationError } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection, unwrap } from "@/lib/api/browser-client";
import { payloadSignature } from "@/lib/api/idempotency";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { cn } from "@/lib/utils";

const BINDING_ICON: Record<Binding, ReactNode> = {
  none: <Ban className="size-4" />,
  staple: <Paperclip className="size-4" />,
  spiral: <Notebook className="size-4" />,
  beads: <CircleDot className="size-4" />,
  thermal: <BookMarked className="size-4" />,
  other: <Ellipsis className="size-4" />,
};

interface DoneOrder { id: number; total_price: string; paid_amount: string; due_amount: string; currency: string }

function Stepper({ id, value, onChange, max, invalid, label }: { id: string; value: string; onChange: (next: string) => void; max: number; invalid: boolean; label: string }) {
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

function useShopCatalog() {
  const products = useQuery({ queryKey: ["print-products-counter"], staleTime: 60_000, queryFn: async () => normalizeCollection<ShopProduct>(await apiFetch("/api/v1/printing/products/")) });
  const options = useQuery({ queryKey: ["print-options-counter"], staleTime: 60_000, queryFn: async () => unwrap(apiFetch<{ data: { binding_types: ShopBinding[] } }>("/api/v1/printing/options/")) });
  return { products: products.data?.results ?? [], bindings: options.data?.binding_types ?? [] };
}

function LineCard({ line, index, canRemove, quoteLine, currency, showErrors, onChange, onRemove }: {
  line: CounterLine; index: number; canRemove: boolean; quoteLine?: QuoteLine; currency: FinanceCurrency; showErrors: boolean;
  onChange: (patch: Partial<CounterLine>) => void; onRemove: () => void;
}) {
  const { t, enumLabel, locale } = useI18n();
  const problems = lineProblems(line);
  const sheets = lineSheets(line);
  const colorOptions: SegmentedOption<CounterLine["colorMode"]>[] = (["black_white", "color"] as const).map((value) => ({ value, label: enumLabel(value) }));
  const sideOptions: SegmentedOption<CounterLine["sides"]>[] = (["one_sided", "double_sided"] as const).map((value) => ({ value, label: enumLabel(value) }));
  const paperOptions: SegmentedOption<CounterLine["paperSize"]>[] = COUNTER_PAPERS.map((value) => ({ value, label: value }));
  const bindingOptions: SegmentedOption<Binding>[] = COUNTER_BINDINGS.map((value) => ({ value, label: enumLabel(value), icon: BINDING_ICON[value] }));
  const id = `counter-${line.key}`;
  const catalog = useShopCatalog();
  const custom = catalog.bindings.filter((type) => !COUNTER_BINDINGS.includes(type.code));
  const bindingChoices: SegmentedOption<Binding>[] = [...bindingOptions, ...custom.map((type) => ({ value: type.code, label: type.name || type.code, icon: <BookMarked className="size-4" /> }))];
  if (line.productId !== null) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="text-base">{t("counter.itemN", { number: index + 1 })} · {t("counter.productLine")}</CardTitle>
          <div className="flex gap-1">
            <Button type="button" variant="outline" size="sm" onClick={() => onChange({ productId: null, productName: "", title: "" })}>{t("counter.productClear")}</Button>
            {canRemove ? <Button type="button" variant="ghost" size="icon" className="size-10 text-destructive hover:text-destructive" aria-label={t("counter.removeItem", { number: index + 1 })} onClick={onRemove}><Trash2 /></Button> : null}
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
        {canRemove ? <Button type="button" variant="ghost" size="icon" className="size-10 text-destructive hover:text-destructive" aria-label={t("counter.removeItem", { number: index + 1 })} onClick={onRemove}><Trash2 /></Button> : null}
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
              <Input id={`${id}-pages`} inputMode="numeric" dir="ltr" value={line.pages} onChange={(event) => onChange({ pages: event.target.value.replace(/\D/gu, "").slice(0, 6) })} aria-invalid={showErrors && Boolean(problems.pages)} className={cn("h-11 text-center text-base font-bold tabular-nums", showErrors && problems.pages && "border-destructive focus-visible:ring-destructive")} placeholder="0" />
            </Field>
            <Field label={t("counter.copies")} htmlFor={`${id}-copies`} error={showErrors && problems.copies ? t("counter.copiesProblem", { max: COUNTER_MAX_COPIES }) : null}>
              <Stepper id={`${id}-copies`} value={line.copies} onChange={(copies) => onChange({ copies })} max={COUNTER_MAX_COPIES} invalid={showErrors && Boolean(problems.copies)} label={t("counter.copies")} />
            </Field>
          </div>
          <Segmented label={t("counter.color")} value={line.colorMode} options={colorOptions} onChange={(colorMode) => onChange({ colorMode })} />
          <Segmented label={t("counter.sides")} value={line.sides} options={sideOptions} onChange={(sides) => onChange({ sides })} />
          <Segmented label={t("counter.paper")} value={line.paperSize} options={paperOptions} onChange={(paperSize) => onChange({ paperSize })} minItemRem={5} />
          <Segmented label={t("counter.binding")} value={line.binding} options={bindingChoices} onChange={(binding) => onChange({ binding })} minItemRem={8} />
          {line.binding === "other" ? (
            <Field label={t("counter.bindingNote")} htmlFor={`${id}-note`} error={showErrors && problems.bindingNote ? t("counter.noteProblem") : null}>
              <Input id={`${id}-note`} value={line.bindingNote} maxLength={BINDING_NOTE_MAX} onChange={(event) => onChange({ bindingNote: event.target.value })} placeholder={t("counter.bindingNotePlaceholder")} className="h-11" aria-invalid={showErrors && Boolean(problems.bindingNote)} />
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

function SummaryRow({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className={cn("min-w-0 text-muted-foreground", strong && "font-semibold text-foreground")}>{label}</span>
      <span className={cn("shrink-0 font-semibold", strong && "text-base font-black")}>{children}</span>
    </div>
  );
}

function CounterOrderForm() {
  const { t, enumLabel, locale } = useI18n();
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<CounterLine[]>(() => [newLine()]);
  const [currency, setCurrency] = useState<FinanceCurrency>("SYP");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [status, setStatus] = useState<CounterStatus>("delivered");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [priceText, setPriceText] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [paidText, setPaidText] = useState("");
  const [paidTouched, setPaidTouched] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [done, setDone] = useState<DoneOrder | null>(null);

  const allValid = lines.length > 0 && lines.every((line) => Object.keys(lineProblems(line)).length === 0);
  const liveKey = allValid ? JSON.stringify(quoteBody(lines, currency)) : "";
  const settledKey = useDebouncedValue(liveKey, 350);
  const quoteQuery = useQuery({
    queryKey: ["counter-quote", settledKey],
    enabled: settledKey !== "",
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<CounterQuote | null> => parseCounterQuote(await unwrap(apiFetch(COUNTER_PATHS.quote, { method: "POST", body: JSON.parse(settledKey) }))),
  });
  const quote = allValid ? quoteQuery.data ?? null : null;
  const calculating = allValid && (settledKey !== liveKey || quoteQuery.isFetching);

  // The price and the amount received follow the list price until the cashier types their own.
  const suggested = quote?.suggestedTotal ?? "";
  const price = priceTouched ? priceText : suggested;
  const paid = paidTouched ? paidText : defaultPaid(status, price);
  const input = { lines, currency, customerName, customerPhone, price, paid, method, status, notes };
  const ready = orderIsReady(input);
  const priceError = amountProblem(price);
  const paidError = paidProblem(paid, price);
  const due = amountProblem(price) === null && paidError === null ? dueAmount(price, paid) : null;
  const rounding = signedRounding(quote?.rounding ?? null);
  const edited = priceTouched && suggested !== "" && Number(priceText) !== Number(suggested);

  const mutateKey = useIdempotencyKey();
  const mutateError = useMutationError(mutateKey);
  const body = useMemo(() => (ready ? createBody(input) : null), [ready, input.lines, input.currency, input.customerName, input.customerPhone, input.price, input.paid, input.method, input.status, input.notes]); // eslint-disable-line react-hooks/exhaustive-deps
  const create = useMutation({
    mutationFn: async () => {
      if (!body) throw new Error("The order is not ready");
      return unwrap<DoneOrder>(apiFetch(COUNTER_PATHS.create, { method: "POST", body, idempotencyKey: mutateKey.get(payloadSignature("counter-create", body)) }));
    },
    onSuccess(order) {
      mutateKey.reset();
      setDone(order as DoneOrder);
      void queryClient.invalidateQueries({ queryKey: ["printing-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["finance-stock"] });
    },
    onError: mutateError,
  });

  const money = (value: string) => formatMoney(value, currency, locale);
  const priceMessage = (problem: ReturnType<typeof amountProblem>) => (problem === "required" ? t("counter.problemRequired") : problem === "tooMany" ? t("counter.problemTooMany") : problem ? t("counter.problemInvalid") : null);

  function updateLine(key: string, patch: Partial<CounterLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }
  function reset() {
    setLines([newLine()]); setCustomerName(""); setCustomerPhone(""); setNotes(""); setStatus("delivered"); setMethod("cash");
    setPriceText(""); setPriceTouched(false); setPaidText(""); setPaidTouched(false); setShowErrors(false); setDone(null); create.reset();
  }

  if (done) {
    return (
      <Card className="mx-auto max-w-xl border-emerald-500/40">
        <CardContent className="space-y-5 p-8 text-center">
          <CheckCircle2 className="mx-auto size-14 text-emerald-600" aria-hidden="true" />
          <div className="space-y-2">
            <h2 className="text-xl font-black">{t("counter.doneTitle", { id: done.id })}</h2>
            <p className="text-sm text-muted-foreground"><bdi>{t("counter.doneBody", { price: formatMoney(done.total_price, done.currency, locale), paid: formatMoney(done.paid_amount, done.currency, locale), due: formatMoney(done.due_amount, done.currency, locale) })}</bdi></p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button type="button" onClick={reset}><Plus />{t("counter.newOrder")}</Button>
            <Button asChild variant="outline"><Link href={`/${locale}/dashboard/printing?search=${done.id}`}>{t("counter.viewOrders")}</Link></Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{t("counter.customer")}</CardTitle><CardDescription>{t("counter.customerHint")}</CardDescription></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <Field label={t("counter.customerName")} htmlFor="counter-customer-name" optional={t("counter.optional")}>
              <Input id="counter-customer-name" className="h-11" value={customerName} maxLength={150} onChange={(event) => setCustomerName(event.target.value)} placeholder={t("counter.customerNamePlaceholder")} />
            </Field>
            <Field label={t("counter.customerPhone")} htmlFor="counter-customer-phone" optional={t("counter.optional")}>
              <Input id="counter-customer-phone" className="h-11" dir="ltr" inputMode="tel" value={customerPhone} maxLength={32} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="09xx xxx xxx" />
            </Field>
            <div className="sm:col-span-2"><Segmented label={t("counter.currency")} value={currency} options={FINANCE_CURRENCIES.map((value) => ({ value, label: enumLabel(value) }))} onChange={(next) => { setCurrency(next); setPriceTouched(false); setPaidTouched(false); }} minItemRem={10} /></div>
          </CardContent>
        </Card>

        <div className="space-y-1">
          <h2 className="text-lg font-black">{t("counter.items")}</h2>
          <p className="text-sm text-muted-foreground">{t("counter.itemsHint")}</p>
        </div>
        {lines.map((line, index) => (
          <LineCard key={line.key} line={line} index={index} canRemove={lines.length > 1} quoteLine={quote?.lines[index]} currency={currency} showErrors={showErrors}
            onChange={(patch) => updateLine(line.key, patch)} onRemove={() => setLines((current) => current.filter((item) => item.key !== line.key))} />
        ))}
        <div className="space-y-2">
          <Button type="button" variant="outline" className="h-11" disabled={lines.length >= COUNTER_MAX_LINES} onClick={() => setLines((current) => [...current, newLine()])}><Plus />{t("counter.addItem")}</Button>
          {lines.length >= COUNTER_MAX_LINES ? <p className="text-xs text-muted-foreground">{t("counter.limit", { max: COUNTER_MAX_LINES })}</p> : null}
        </div>
      </div>

      <aside className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pe-1" aria-label={t("counter.summary")}>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Printer className="size-4 text-primary" aria-hidden="true" />{t("counter.summary")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!allValid ? <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{t("counter.fillLines")}</p> : calculating && !quote ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t("counter.calculating")}</p> : quoteQuery.isError ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">{t("counter.quoteFailed")}</p> : quote ? (
              <div className={cn("space-y-2 transition-opacity", calculating && "opacity-60")}>
                {quote.lines.map((item, index) => (
                  <SummaryRow key={lines[index]?.key ?? index} label={lines[index]?.title.trim() || t("counter.itemN", { number: index + 1 })}>{item.subtotal ? <Money value={item.subtotal} currency={currency} /> : "—"}</SummaryRow>
                ))}
                {quote.complete ? (
                  <>
                    <div className="my-2 border-t" />
                    <SummaryRow label={t("counter.exactTotal")}><Money value={quote.exactTotal} currency={currency} /></SummaryRow>
                    {rounding ? <SummaryRow label={t("counter.rounding")}><bdi dir="ltr" className="tabular-nums">{rounding}</bdi></SummaryRow> : null}
                    <SummaryRow label={t("counter.suggested")} strong><Money value={suggested} currency={currency} /></SummaryRow>
                    {currency === "SYP" ? <p className="pt-1 text-xs leading-5 text-muted-foreground">{t("counter.roundingNote")}</p> : null}
                  </>
                ) : <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-800 dark:text-amber-200">{t("counter.noSuggestion")}</p>}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5 p-5">
            <Field label={t("counter.price")} htmlFor="counter-price" error={showErrors ? priceMessage(priceError) : null} hint={edited ? t("counter.priceEdited") : undefined}>
              <Input id="counter-price" className={cn("h-12 text-center text-lg font-black tabular-nums", showErrors && priceError && "border-destructive focus-visible:ring-destructive")} dir="ltr" inputMode="decimal" value={price} aria-invalid={showErrors && Boolean(priceError)}
                onChange={(event) => { setPriceTouched(true); setPriceText(event.target.value.replace(/[^\d.]/gu, "")); }} placeholder="0" />
            </Field>
            {priceTouched && suggested !== "" && Number(priceText) !== Number(suggested) ? <Button type="button" variant="ghost" size="sm" className="-mt-2 h-auto whitespace-normal px-2 py-1.5 text-start" onClick={() => setPriceTouched(false)}>{t("counter.useSuggested")}: <bdi className="ms-1">{money(suggested)}</bdi></Button> : null}
            <Segmented label={t("counter.status")} value={status} options={COUNTER_STATUSES.map((value) => ({ value, label: enumLabel(value) }))} onChange={(next) => { setStatus(next); setPaidTouched(false); }} minItemRem={6} />
            <p className="-mt-3 text-xs leading-5 text-muted-foreground">{t("counter.statusHint")}</p>
            <Segmented label={t("counter.method")} value={method} options={PAYMENT_METHODS.map((value) => ({ value, label: enumLabel(value) }))} onChange={setMethod} minItemRem={7} />
            <Field label={t("counter.paid")} htmlFor="counter-paid" error={showErrors ? (paidError === "exceeds" ? t("counter.problemExceeds") : priceMessage(paidError)) : null}>
              <Input id="counter-paid" className={cn("h-11 text-center text-base font-bold tabular-nums", showErrors && paidError && "border-destructive focus-visible:ring-destructive")} dir="ltr" inputMode="decimal" value={paid} aria-invalid={showErrors && Boolean(paidError)}
                onChange={(event) => { setPaidTouched(true); setPaidText(event.target.value.replace(/[^\d.]/gu, "")); }} placeholder="0" />
            </Field>
            {due !== null ? <SummaryRow label={t("counter.due")} strong><Money value={due} currency={currency} className={Number(due) > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"} /></SummaryRow> : null}
            <Field label={t("counter.notes")} htmlFor="counter-notes" optional={t("counter.optional")}>
              <Textarea id="counter-notes" rows={2} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t("counter.notesPlaceholder")} />
            </Field>
            {showErrors && !ready ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{t("counter.fixErrors")}</p> : null}
            {ready && due !== null ? (
              <ConfirmDialog
                trigger={<Button type="button" className="h-12 w-full text-base font-bold" disabled={create.isPending || calculating}>{create.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}{create.isPending ? t("counter.submitting") : t("counter.submit")}</Button>}
                title={t("counter.confirmTitle")}
                description={t("counter.confirmDescription", { price: money(price), paid: money(paid), due: money(due) })}
                confirmLabel={t("counter.submit")}
                cancelLabel={t("common.cancel")}
                onConfirm={() => create.mutate()}
              />
            ) : <Button type="button" className="h-12 w-full text-base font-bold" onClick={() => setShowErrors(true)}><CheckCircle2 />{t("counter.submit")}</Button>}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

export function CounterOrderPage() {
  const { t, locale } = useI18n();
  return (
    <CapabilityGate capability={CAPABILITIES.printing}>
      <div className="space-y-6">
        <PageHeader
          title={t("counter.title")}
          description={t("counter.subtitle")}
          eyebrow={t("nav.operations")}
          actions={<Button asChild variant="outline"><Link href={`/${locale}/dashboard/printing`}><ArrowRight className="rtl:rotate-0 ltr:rotate-180" />{t("counter.back")}</Link></Button>}
        />
        <CounterOrderForm />
      </div>
    </CapabilityGate>
  );
}
