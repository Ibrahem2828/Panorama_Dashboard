"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Plus, Printer } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { FINANCE_CURRENCIES, PAYMENT_METHODS, dueAmount, formatMoney, type FinanceCurrency, type PaymentMethod } from "@/features/finance/finance-rules";
import { LineCard } from "@/features/printing/counter-line-card";
import {
  COUNTER_MAX_LINES, COUNTER_PATHS, COUNTER_STATUSES,
  amountProblem, createBody, defaultPaid, linesFromOrderItems, newLine, orderIsReady, paidProblem, signedRounding,
  type CounterLine, type CounterStatus,
} from "@/features/printing/counter-order-rules";
import { Field, Segmented } from "@/features/printing/segmented";
import { itemFieldErrors } from "@/features/printing/server-errors";
import { useCounterQuote } from "@/features/printing/use-counter-quote";
import { useIdempotencyKey, useMutationError } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import { apiFetch, unwrap } from "@/lib/api/browser-client";
import { payloadSignature } from "@/lib/api/idempotency";
import { cn } from "@/lib/utils";

interface DoneOrder { id: number; total_price: string; paid_amount: string; due_amount: string; currency: string }

function SummaryRow({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className={cn("min-w-0 text-muted-foreground", strong && "font-semibold text-foreground")}>{label}</span>
      <span className={cn("shrink-0 font-semibold", strong && "text-base font-black")}>{children}</span>
    </div>
  );
}

export function CounterOrderForm({ initialLines }: { initialLines?: CounterLine[] }) {
  const { t, enumLabel, locale } = useI18n();
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<CounterLine[]>(() => (initialLines?.length ? initialLines : [newLine()]));
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

  const { allValid, quote, calculating, isError: quoteFailed, error: quoteError } = useCounterQuote(lines, currency);

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

  // What the server rejected, per line and field (a 400 of the quote or of the save), shown next to the field it is about.
  const serverItemErrors = itemFieldErrors(create.error ?? quoteError);
  const money = (value: string) => formatMoney(value, currency, locale);
  const priceMessage = (problem: ReturnType<typeof amountProblem>) => (problem === "required" ? t("counter.problemRequired") : problem === "tooMany" ? t("counter.problemTooMany") : problem ? t("counter.problemInvalid") : null);

  function updateLine(key: string, patch: Partial<CounterLine>) {
    create.reset(); // an old rejection no longer applies to what was just edited
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
            <Button asChild variant="outline"><Link href={`/${locale}/dashboard/printing?tab=orders&search=${done.id}`}>{t("counter.viewOrders")}</Link></Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start"
      onKeyDown={(event) => {
        // Cashier shortcut: Ctrl/Cmd + Enter registers the order (or shows what is missing) from any field.
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); document.getElementById("counter-submit")?.click(); }
      }}
    >
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
          <LineCard key={line.key} autoFocusPages={index > 0 && !line.pages} line={line} index={index} canRemove={lines.length > 1} quoteLine={quote?.lines[index]} currency={currency} showErrors={showErrors} serverErrors={serverItemErrors[index]}
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
            {!allValid ? <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{t("counter.fillLines")}</p> : calculating && !quote ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t("counter.calculating")}</p> : quoteFailed ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">{t("counter.quoteFailed")}</p> : quote ? (
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
            <p className="text-center text-xs text-muted-foreground">{t("counter.shortcutHint")}</p>
            {ready && due !== null ? (
              <ConfirmDialog
                trigger={<Button id="counter-submit" type="button" className="h-12 w-full text-base font-bold" disabled={create.isPending || calculating}>{create.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}{create.isPending ? t("counter.submitting") : t("counter.submit")}</Button>}
                title={t("counter.confirmTitle")}
                description={t("counter.confirmDescription", { price: money(price), paid: money(paid), due: money(due) })}
                confirmLabel={t("counter.submit")}
                cancelLabel={t("common.cancel")}
                onConfirm={() => create.mutate()}
              />
            ) : <Button id="counter-submit" type="button" className="h-12 w-full text-base font-bold" onClick={() => setShowErrors(true)}><CheckCircle2 />{t("counter.submit")}</Button>}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

/** The "counter sale" tab: an empty form, or one pre-filled from an existing order (`from`) to reprint or duplicate it. */
export function CounterOrderTab({ copyFrom }: { copyFrom: number | null }) {
  const { t } = useI18n();
  const source = useQuery({
    queryKey: ["printing-order-copy", copyFrom],
    enabled: copyFrom !== null,
    staleTime: 0,
    queryFn: async () => (await unwrap<{ id: number; items?: unknown }>(apiFetch(`/api/v1/dashboard/printing/orders/${copyFrom}/`))) as { id: number; items?: unknown },
  });
  if (copyFrom !== null && source.isPending) return <Skeleton className="h-96 rounded-2xl" />;
  if (copyFrom !== null && source.isError) return <ErrorPanel error={source.error} retry={() => source.refetch()} />;
  const lines = copyFrom !== null && source.data ? linesFromOrderItems(source.data.items) : [];
  return (
    <div className="space-y-4">
      {copyFrom !== null ? <p role="status" className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">{lines.length ? t("counter.copiedFrom", { id: copyFrom }) : t("counter.copiedEmpty", { id: copyFrom })}</p> : null}
      <CounterOrderForm key={copyFrom ?? "new"} initialLines={lines} />
    </div>
  );
}
