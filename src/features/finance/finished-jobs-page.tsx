"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, HandCoins, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Pagination } from "@/components/data-grid/pagination";
import { CapabilityGate } from "@/components/feedback/capability-gate";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  FINANCE_CURRENCIES, FINANCE_PATHS, PAYMENT_METHODS, VOID_REASON_MAX, VOID_REASON_MIN, dueAmount, formatMoney, paymentAmountProblem, paymentBody,
  paymentState, paymentVoidPath, parseJobTotals, periodQuery, toMinor, type PaymentMethod, type PaymentState,
} from "@/features/finance/finance-rules";
import { PeriodFilter, usePeriod } from "@/features/finance/period-filter";
import { useCan } from "@/features/session";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useIdempotencyKey, useMutationError } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection, unwrap } from "@/lib/api/browser-client";
import { apiErrorText } from "@/lib/api/error-message";
import { payloadSignature } from "@/lib/api/idempotency";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { formatDate, formatNumber } from "@/lib/utils";

interface Job {
  id: number;
  customer: string;
  completed_at: string;
  files_count: number;
  pages_count: number;
  sheets_count: number;
  total_price: string;
  currency: string;
  paid: string;
  due: string;
  is_paid: boolean;
}
interface Payment { id: number; order: number; amount: string; currency: string; method: string; received_at: string; note?: string; received_by_name?: string | null }

const ALL = "__all__";
const PAGE_SIZE = 25;

const STATE_STYLE: Record<PaymentState, "success" | "warning" | "destructive"> = { paid: "success", partial: "warning", unpaid: "destructive" };

function PaymentPill({ job }: { job: Job }) {
  const { t } = useI18n();
  const state = paymentState(job.total_price, job.paid);
  return <Badge variant={STATE_STYLE[state]} className="whitespace-nowrap rounded-full">{t(`finance.jobs.state.${state}` as "finance.jobs.state.paid")}</Badge>;
}

/** Record a (possibly partial) payment; the amount starts at what is still due. */
function PaymentDialog({ job, onOpenChange }: { job: Job | null; onOpenChange: (open: boolean) => void }) {
  const { t, enumLabel, locale } = useI18n();
  const queryClient = useQueryClient();
  const due = job ? dueAmount(job.total_price, job.paid) : "0.00";
  const [amount, setAmount] = useState(due);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const keys = useIdempotencyKey();
  const keyError = useMutationError(keys);
  const problem = paymentAmountProblem(amount, due);
  const save = useMutation({
    mutationFn: () => {
      const body = paymentBody(job!.id, amount, method, note);
      return apiFetch(FINANCE_PATHS.payments, { method: "POST", body, idempotencyKey: keys.get(payloadSignature("payment", job!.id, body)) });
    },
    onSuccess() {
      keys.reset();
      toast.success(t("finance.pay.done"));
      void queryClient.invalidateQueries({ queryKey: ["finance-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
      onOpenChange(false);
    },
    onError: keyError,
  });
  return (
    <Dialog open={Boolean(job)} onOpenChange={(open) => { if (!open && !save.isPending) onOpenChange(false); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("finance.pay.title", { id: job?.id ?? "" })}</DialogTitle>
          <DialogDescription>{job ? t("finance.pay.summary", { total: formatMoney(job.total_price, job.currency, locale), paid: formatMoney(job.paid, job.currency, locale), due: formatMoney(due, job.currency, locale) }) : ""}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); setTouched(true); if (!problem && !save.isPending) save.mutate(); }}>
          <div className="space-y-2">
            <Label htmlFor="pay-amount">{t("finance.pay.amount")} ({job ? enumLabel(job.currency) : ""})<span className="ms-1 text-destructive" aria-hidden="true">*</span></Label>
            <Input id="pay-amount" dir="ltr" className="text-start" inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={touched && problem ? true : undefined} aria-required />
            {touched && problem ? <p role="alert" className="text-xs font-medium text-destructive">{t(`finance.pay.${problem}` as "finance.pay.invalid")}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-method">{t("finance.pay.method")}</Label>
            <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
              <SelectTrigger id="pay-method"><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_METHODS.map((value) => <SelectItem key={value} value={value}>{enumLabel(value)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-note">{t("finance.pay.note")}</Label>
            <Input id="pay-note" value={note} maxLength={255} onChange={(event) => setNote(event.target.value)} />
          </div>
          {save.error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{apiErrorText(save.error, t)}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>{t("common.cancel")}</Button>
            <Button type="submit" isLoading={save.isPending}>{t("finance.pay.submit")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Admin only: void one mistaken payment of an order, with a written reason (audited by the backend). */
function VoidDialog({ job, onOpenChange }: { job: Job | null; onOpenChange: (open: boolean) => void }) {
  const { t, enumLabel, locale } = useI18n();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const keys = useIdempotencyKey();
  const keyError = useMutationError(keys);
  const payments = useQuery({
    queryKey: ["finance-order-payments", job?.id],
    enabled: Boolean(job),
    queryFn: async () => (await normalizeCollection<Payment>(await apiFetch(`${FINANCE_PATHS.payments}?order=${job!.id}&page_size=100`))).results,
  });
  const reasonOk = reason.trim().length >= VOID_REASON_MIN;
  const ready = selected !== null && reasonOk;
  const remove = useMutation({
    mutationFn: () => {
      const body = { reason: reason.trim() };
      return apiFetch(paymentVoidPath(selected!), { method: "POST", body, idempotencyKey: keys.get(payloadSignature("void", selected, body)) });
    },
    onSuccess() {
      keys.reset();
      toast.success(t("finance.void.done"));
      void queryClient.invalidateQueries({ queryKey: ["finance-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
      onOpenChange(false);
    },
    onError: keyError,
  });
  return (
    <Dialog open={Boolean(job)} onOpenChange={(open) => { if (!open && !remove.isPending) onOpenChange(false); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">{t("finance.void.title", { id: job?.id ?? "" })}</DialogTitle>
          <DialogDescription>{t("finance.void.description")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (ready && !remove.isPending) remove.mutate(); }}>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">{t("finance.void.pick")}</legend>
            {payments.isPending ? <Skeleton className="h-16 rounded-xl" /> : payments.isError ? <ErrorPanel error={payments.error} retry={() => void payments.refetch()} /> : payments.data.length ? payments.data.map((payment) => (
              <label key={payment.id} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input type="radio" name="void-payment" className="size-4 accent-[var(--primary)]" checked={selected === payment.id} onChange={() => setSelected(payment.id)} />
                <span>{t("finance.void.line", { amount: formatMoney(payment.amount, payment.currency, locale), method: enumLabel(payment.method), date: formatDate(payment.received_at, locale) })}</span>
              </label>
            )) : <p className="text-sm text-muted-foreground">{t("finance.void.noPayments")}</p>}
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="void-reason">{t("finance.void.reason")}<span className="ms-1 text-destructive" aria-hidden="true">*</span></Label>
            <Textarea id="void-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={VOID_REASON_MAX} aria-required />
            {reason && !reasonOk ? <p role="alert" className="text-xs font-medium text-destructive">{t("validation.minLength", { n: VOID_REASON_MIN })}</p> : null}
          </div>
          {remove.error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{apiErrorText(remove.error, t)}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={remove.isPending}>{t("common.cancel")}</Button>
            <Button type="submit" variant="destructive" isLoading={remove.isPending} disabled={!ready}>{t("finance.void.submit")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** الطلبات المنتهية: delivered print orders for a period, totals per currency, payment recording (and voiding for admins). */
export function FinishedJobsPage() {
  const { t, enumLabel, locale } = useI18n();
  const canVoid = useCan(CAPABILITIES.finance);
  const period = usePeriod("month");
  const [currency, setCurrency] = useState(ALL);
  const [searchDraft, setSearchDraft] = useState("");
  const search = useDebouncedValue(searchDraft);
  const [payJob, setPayJob] = useState<Job | null>(null);
  const [voidJob, setVoidJob] = useState<Job | null>(null);
  const usable = period.preset !== "custom" || period.problem === null;

  // The page resets to 1 whenever a filter changes (the page is remembered together with the filters it belongs to).
  const filterKey = [period.range.from, period.range.to, currency, search].join("|");
  const [pageState, setPageState] = useState({ key: "", page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (next: number) => setPageState({ key: filterKey, page: next });

  const query = useQuery({
    queryKey: ["finance-jobs", period.range.from, period.range.to, currency, search, page],
    enabled: usable,
    queryFn: async () => {
      const params = periodQuery(period.range, { currency: currency === ALL ? undefined : currency, search: search || undefined });
      params.set("page", String(page));
      params.set("page_size", String(PAGE_SIZE));
      const payload = await unwrap<Record<string, unknown>>(apiFetch(`${FINANCE_PATHS.jobs}?${params}`));
      const collection = await normalizeCollection<Job>(payload);
      return { ...collection, totals: parseJobTotals((payload as Record<string, unknown>)?.totals_by_currency) };
    },
  });

  return (
    <CapabilityGate capability={CAPABILITIES.printing}>
      <div className="space-y-6">
        <PageHeader
          title={t("finance.jobs.title")}
          description={t("finance.jobs.subtitle")}
          eyebrow={t("nav.finance")}
          actions={<Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching || !usable}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />{t("common.refresh")}</Button>}
        />
        <div className="glass-panel flex flex-col gap-3 rounded-2xl border p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <PeriodFilter period={period} />
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={t("finance.jobs.search")} aria-label={t("common.search")} className="h-9 ps-10 sm:w-64" />
              </div>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-9 sm:w-52" aria-label={t("finance.jobs.currency")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("finance.jobs.currency")}: {t("common.all")}</SelectItem>
                  {FINANCE_CURRENCIES.map((code) => <SelectItem key={code} value={code}>{enumLabel(code)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {!usable ? <p className="text-sm text-muted-foreground">{t("finance.period.pick")}</p> : query.isPending ? <Skeleton className="h-96 rounded-2xl" /> : query.isError ? <ErrorPanel error={query.error} retry={() => void query.refetch()} /> : (
          <>
            <section aria-label={t("finance.jobs.totals")} className="grid gap-3 sm:grid-cols-2">
              {query.data.totals.length ? query.data.totals.map((row) => (
                <Card key={row.currency}>
                  <CardHeader className="pb-2"><CardDescription>{t("finance.jobs.totals")} · {enumLabel(row.currency)}</CardDescription></CardHeader>
                  <CardContent>
                    <p className="text-2xl font-black"><Money value={row.total} currency={row.currency} /></p>
                    <p className="mt-1 text-xs text-muted-foreground">{t("finance.jobs.ordersCount", { n: formatNumber(row.orders, "en") })}</p>
                  </CardContent>
                </Card>
              )) : null}
            </section>
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/55 text-xs text-muted-foreground">
                    <tr>{["#", "finance.jobs.customer", "finance.jobs.completedAt", "finance.jobs.files", "finance.jobs.pages", "finance.jobs.sheets", "finance.jobs.total", "finance.jobs.paid", "finance.jobs.due", "finance.jobs.state", "common.actions"].map((key) => <th key={key} className="whitespace-nowrap p-3 text-start font-bold">{key === "#" ? "#" : t(key as "common.actions")}</th>)}</tr>
                  </thead>
                  <tbody>
                    {query.data.results.map((job) => {
                      const due = dueAmount(job.total_price, job.paid);
                      const canPay = (toMinor(due) ?? 0) > 0;
                      const canVoidRow = canVoid && (toMinor(job.paid) ?? 0) > 0;
                      return (
                        <tr key={job.id} className="border-t hover:bg-muted/30">
                          <td className="p-3 tabular-nums">{job.id}</td>
                          <td className="p-3 font-semibold">{job.customer}</td>
                          <td className="whitespace-nowrap p-3">{formatDate(job.completed_at, locale)}</td>
                          <td className="p-3 tabular-nums">{formatNumber(job.files_count, "en")}</td>
                          <td className="p-3 tabular-nums">{formatNumber(job.pages_count, "en")}</td>
                          <td className="p-3 tabular-nums">{formatNumber(job.sheets_count, "en")}</td>
                          <td className="p-3"><Money value={job.total_price} currency={job.currency} /></td>
                          <td className="p-3"><Money value={job.paid} currency={job.currency} /></td>
                          <td className="p-3"><Money value={due} currency={job.currency} /></td>
                          <td className="p-3"><PaymentPill job={job} /></td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-2">
                              {canPay ? <Button size="sm" onClick={() => setPayJob(job)}><HandCoins />{t("finance.pay.action")}</Button> : null}
                              {canVoidRow ? <Button size="sm" variant="outline" className="text-destructive" onClick={() => setVoidJob(job)}><Ban />{t("finance.void.action")}</Button> : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!query.data.results.length ? <tr><td colSpan={11} className="h-36 p-3 text-center text-muted-foreground">{t("finance.jobs.empty")}</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} count={query.data.count} onPage={setPage} onPageSize={() => undefined} />
          </>
        )}
        <PaymentDialog key={`pay-${payJob?.id ?? "none"}`} job={payJob} onOpenChange={(open) => { if (!open) setPayJob(null); }} />
        <VoidDialog key={`void-${voidJob?.id ?? "none"}`} job={voidJob} onOpenChange={(open) => { if (!open) setVoidJob(null); }} />
      </div>
    </CapabilityGate>
  );
}
