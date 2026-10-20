"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Coins, MessageSquarePlus, Plus, RefreshCw, Search, Store, Smartphone, StepForward, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { Pagination } from "@/components/data-grid/pagination";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { Money } from "@/components/shared/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FINANCE_PATHS, PAYMENT_METHODS, formatMoney, paymentAmountProblem, paymentBody, paymentState, type PaymentMethod, type PaymentState } from "@/features/finance/finance-rules";
import { nextStatus } from "@/features/printing/counter-order-rules";
import { OrderItemsPanel } from "@/features/printing/order-items-panel";
import { signedRounding } from "@/features/printing/counter-order-rules";
import { RESOURCE_COLUMNS } from "@/features/resources/columns";
import { ResourceManager, type ManagerFilter } from "@/features/resources/resource-manager";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";
import { useIdempotencyKey, useMutationError } from "@/hooks/use-idempotency-key";
import { payloadSignature } from "@/lib/api/idempotency";
import { useAssignees } from "@/features/staff/use-assignees";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

interface PrintOrder {
  id: number;
  user_name: string;
  source?: "app" | "counter";
  customer_name?: string;
  customer_phone?: string;
  created_by_name?: string | null;
  status: string;
  priority: string;
  total_price: string;
  paid_amount?: string;
  due_amount?: string;
  rounding_adjustment?: string;
  currency: string;
  assigned_to?: number | null;
  assigned_to_name?: string;
  user_notes?: string;
  internal_notes?: string;
  created_at: string;
  items?: unknown;
  pickup_location_detail?: { name?: string; address?: string; instructions?: string } | null;
  stock_deducted_at?: string | null;
  stock_usage?: { item: string; unit: string; quantity: string }[];
  status_history?: unknown[];
}

const CURRENCIES = ["SYP", "USD"] as const;
const SOURCES = ["counter", "app"] as const;
const statuses = ["submitted", "under_review", "accepted", "printing", "ready", "delivered", "cancelled", "rejected"];
const PAYMENT_STYLE: Record<PaymentState, "success" | "warning" | "destructive"> = { paid: "success", partial: "warning", unpaid: "destructive" };

function SourceBadge({ source }: { source?: string }) {
  const { t } = useI18n();
  const counter = source === "counter";
  return (
    <Badge variant="outline" className={cn("gap-1 whitespace-nowrap rounded-full", counter ? "border-primary/30 bg-primary/10 text-primary" : "text-muted-foreground")}>
      {counter ? <Store className="size-3" aria-hidden="true" /> : <Smartphone className="size-3" aria-hidden="true" />}
      {counter ? t("printing.sourceCounter") : t("printing.sourceApp")}
    </Badge>
  );
}

function PaymentBadge({ order }: { order: PrintOrder }) {
  const { t } = useI18n();
  if (order.paid_amount === undefined) return <span className="text-muted-foreground">—</span>;
  const state = paymentState(order.total_price, order.paid_amount);
  return <Badge variant={PAYMENT_STYLE[state]} className="whitespace-nowrap rounded-full">{t(`finance.jobs.state.${state}` as "finance.jobs.state.paid")}</Badge>;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 break-words text-sm font-bold">{children}</div>
    </div>
  );
}

type DialogAction = "status" | "assign" | "note" | "payment" | null;

function OrderDialog({ order, onClose }: { order: PrintOrder; onClose: () => void }) {
  const { t, enumLabel, locale } = useI18n();
  const queryClient = useQueryClient();
  const assignees = useAssignees("printing");
  const [action, setAction] = useState<DialogAction>(null);
  const [nextValue, setNextValue] = useState("under_review");
  const [assignedTo, setAssignedTo] = useState("");
  const [publicNote, setPublicNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [amount, setAmount] = useState(order.due_amount && Number(order.due_amount) > 0 ? order.due_amount : "");
  const [method, setMethod] = useState<PaymentMethod>("cash");

  const mutateKey = useIdempotencyKey();
  const mutateError = useMutationError(mutateKey);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["printing-orders"] });
    void queryClient.invalidateQueries({ queryKey: ["finance-stock"] }); // delivering an order deducts stock
  };
  const mutate = useMutation({
    mutationFn: async (override?: { status: string }) => {
      const send = (path: string, httpMethod: "PATCH" | "POST", body: Record<string, unknown>) =>
        apiFetch(path, { method: httpMethod, body, idempotencyKey: mutateKey.get(payloadSignature(path, order.id, body)) });
      if (override) return send(`/api/v1/dashboard/printing/orders/${order.id}/status/`, "PATCH", { status: override.status });
      if (action === "status") {
        const body = { status: nextValue, public_note: publicNote, internal_note: internalNote, rejected_reason: nextValue === "rejected" ? publicNote : "" };
        return send(`/api/v1/dashboard/printing/orders/${order.id}/status/`, "PATCH", body);
      }
      if (action === "assign") return send(`/api/v1/dashboard/printing/orders/${order.id}/assign/`, "PATCH", { assigned_to: Number(assignedTo) });
      if (action === "note") return send(`/api/v1/dashboard/printing/orders/${order.id}/note/`, "POST", { internal_notes: internalNote });
      if (action === "payment") return send(FINANCE_PATHS.payments, "POST", paymentBody(order.id, amount, method, ""));
      throw new Error("Missing action");
    },
    onSuccess() {
      const paid = action === "payment";
      mutateKey.reset();
      toast.success(paid ? t("printing.paymentSaved") : t("common.success"));
      setAction(null); setPublicNote(""); setInternalNote("");
      refresh();
    },
    onError: mutateError,
  });

  const next = nextStatus(order.status);
  const due = order.due_amount ?? "0";
  const owes = Number(due) > 0;
  const amountError = action === "payment" ? paymentAmountProblem(amount, due) : null;
  const rounding = signedRounding(order.rounding_adjustment ?? null);
  const counter = order.source === "counter";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader className="pe-10">
          <DialogTitle className="flex flex-wrap items-center gap-2">{t("printing.orderDetails")} <bdi>#{order.id}</bdi><SourceBadge source={order.source} /></DialogTitle>
          <DialogDescription>{order.user_name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label={t("common.status")}><StatusPill value={order.status} /></Detail>
            <Detail label={t("printing.value")}>
              <Money value={order.total_price} currency={order.currency} />
              {rounding ? <span className="mt-0.5 block text-xs font-normal text-muted-foreground"><bdi>{t("printing.roundingLine", { amount: rounding })}</bdi></span> : null}
            </Detail>
            <Detail label={t("printing.paidAmount")}>{order.paid_amount !== undefined ? <Money value={order.paid_amount} currency={order.currency} /> : "—"}</Detail>
            <Detail label={t("printing.dueAmount")}>{order.due_amount !== undefined ? <Money value={order.due_amount} currency={order.currency} className={owes ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"} /> : "—"}</Detail>
            <Detail label={t("printing.customer")}>{order.user_name}</Detail>
            {counter && order.customer_phone ? <Detail label={t("printing.contact")}><bdi dir="ltr">{order.customer_phone}</bdi></Detail> : null}
            {counter && order.created_by_name ? <Detail label={t("printing.createdBy")}>{order.created_by_name}</Detail> : null}
            <Detail label={t("support.assign")}>{order.assigned_to_name || "—"}</Detail>
            {!counter ? <Detail label={t("printing.priority")}>{enumLabel(order.priority)}</Detail> : null}
          </div>

          <OrderItemsPanel key={order.id} orderId={order.id} items={order.items} currency={order.currency} pickup={order.pickup_location_detail} />

          {order.stock_deducted_at ? (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">{t("printing.stockUsage")}</CardTitle><CardDescription>{t("printing.stockUsageHint")}</CardDescription></CardHeader>
              <CardContent>
                {order.stock_usage?.length ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {order.stock_usage.map((usage) => (
                      <li key={usage.item} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                        <span className="min-w-0 break-words">{usage.item}</span>
                        <bdi className="shrink-0 font-bold tabular-nums">{usage.quantity} <span className="font-normal text-muted-foreground">{usage.unit}</span></bdi>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">{t("printing.stockUsageNone")}</p>}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle className="text-base">{t("printing.userNotes")}</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{order.user_notes || "—"}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">{t("printing.internalNotes")}</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{order.internal_notes || "—"}</CardContent></Card>
          </div>

          <div className="flex flex-wrap gap-2">
            {next ? (
              <ConfirmDialog
                trigger={<Button disabled={mutate.isPending}><StepForward />{t("printing.nextStep", { status: enumLabel(next) })}</Button>}
                title={t("printing.confirmStatusTitle")}
                description={t("printing.confirmStatusDescription", { status: enumLabel(next) })}
                confirmLabel={t("common.save")}
                cancelLabel={t("common.cancel")}
                onConfirm={() => mutate.mutate({ status: next })}
              />
            ) : null}
            {owes ? <Button variant="outline" onClick={() => { setAmount(due); setAction("payment"); }}><Coins />{t("printing.recordPayment")}</Button> : null}
            <Button variant="outline" onClick={() => setAction("status")}><RefreshCw />{t("printing.changeStatus")}</Button>
            <Button variant="outline" onClick={() => setAction("assign")}><UserRoundCheck />{t("support.assign")}</Button>
            <Button variant="outline" onClick={() => setAction("note")}><MessageSquarePlus />{t("printing.addNote")}</Button>
          </div>

          {action ? (
            <Card className="border-primary/30">
              <CardHeader><CardTitle className="text-base">{action === "status" ? t("printing.changeStatus") : action === "assign" ? t("support.assign") : action === "payment" ? t("printing.recordPayment") : t("printing.addNote")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {action === "status" ? (
                  <>
                    <div className="space-y-2"><Label>{t("common.status")}</Label><Select value={nextValue} onValueChange={setNextValue}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((value) => <SelectItem key={value} value={value}>{enumLabel(value)}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>{t("printing.publicNote")}</Label><Textarea value={publicNote} onChange={(event) => setPublicNote(event.target.value)} /></div>
                    <div className="space-y-2"><Label>{t("printing.internalNotes")}</Label><Textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} /></div>
                  </>
                ) : null}
                {action === "assign" ? (
                  <div className="space-y-2">
                    <Label>{t("support.assign")}</Label>
                    <Select value={assignedTo} onValueChange={setAssignedTo}><SelectTrigger><SelectValue placeholder={t("support.selectAgent")} /></SelectTrigger><SelectContent>{assignees.options.map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>)}</SelectContent></Select>
                    {assignees.limited ? <p className="text-xs leading-5 text-muted-foreground">{t("assignees.limited")}</p> : null}
                  </div>
                ) : null}
                {action === "note" ? <div className="space-y-2"><Label>{t("printing.internalNotes")}</Label><Textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} /></div> : null}
                {action === "payment" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="order-pay-amount">{t("printing.paymentAmount")} <span className="text-xs font-normal text-muted-foreground"><bdi>({t("printing.dueAmount")}: {formatMoney(due, order.currency, locale)})</bdi></span></Label>
                      <Input id="order-pay-amount" dir="ltr" inputMode="decimal" className={cn("h-11 text-center font-bold tabular-nums", amountError && "border-destructive")} value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/gu, ""))} aria-invalid={Boolean(amountError)} />
                      {amountError ? <p role="alert" className="text-xs font-medium text-destructive">{amountError === "exceeds" ? t("counter.problemExceeds") : amountError === "tooMany" ? t("counter.problemTooMany") : t("counter.problemInvalid")}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label>{t("printing.paymentMethod")}</Label>
                      <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map((value) => <SelectItem key={value} value={value}>{enumLabel(value)}</SelectItem>)}</SelectContent></Select>
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" onClick={() => setAction(null)}>{t("common.cancel")}</Button>
                  {action === "status" ? (
                    <ConfirmDialog trigger={<Button disabled={mutate.isPending}>{t("common.save")}</Button>} title={t("printing.confirmStatusTitle")} description={t("printing.confirmStatusDescription", { status: enumLabel(nextValue) })} confirmLabel={t("common.save")} cancelLabel={t("common.cancel")} onConfirm={() => mutate.mutate(undefined)} />
                  ) : (
                    <Button onClick={() => mutate.mutate(undefined)} disabled={mutate.isPending || (action === "assign" && !assignedTo) || (action === "payment" && (amountError !== null || amount === ""))}>{t("common.save")}</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>{t("common.close")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PrintOrdersPanel() {
  const { t, enumLabel, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "all";
  const source = searchParams.get("source") ?? "all";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("page_size") ?? 25)));
  const [searchDraft, setSearchDraft] = useState(search);
  const debouncedSearch = useDebouncedValue(searchDraft);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<PrintOrder | null>(null);

  const updateUrl = useCallback((changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, String(value));
    }
    router.replace(`?${next.toString()}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    if (debouncedSearch !== search) updateUrl({ search: debouncedSearch, page: 1 });
  }, [debouncedSearch, search, updateUrl]);

  const query = useQuery({
    queryKey: ["printing-orders", page, pageSize, search, status, source],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize), ordering: "-created_at" });
      if (search) params.set("search", search);
      if (status !== "all") params.set("status", status);
      if (source !== "all") params.set("source", source);
      return normalizeCollection<PrintOrder>(await apiFetch(`/api/v1/dashboard/printing/orders/?${params}`));
    },
  });
  // The open order follows the refreshed list, so a status change or payment shows at once; the snapshot covers an order that left the page.
  const selected = selectedId === null ? null : (query.data?.results.find((order) => order.id === selectedId) ?? snapshot);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardDescription>{t("printing.orders")}</CardDescription><CardTitle>{query.data?.count ?? 0}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>{t("printing.ordersOnPage")}</CardDescription><CardTitle>{query.data?.results.length ?? 0}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>{t("common.status")}</CardDescription><CardTitle>{status === "all" ? t("common.all") : enumLabel(status)}</CardTitle></CardHeader></Card>
      </div>

      <div className="glass-panel grid gap-3 rounded-2xl border p-3 md:grid-cols-[minmax(0,1fr)_11rem_11rem_auto]">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input className="ps-10" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={t("printing.ordersSearch")} aria-label={t("common.search")} />
        </div>
        <Select value={status} onValueChange={(value) => updateUrl({ status: value === "all" ? null : value, page: 1 })}><SelectTrigger aria-label={t("common.status")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("common.all")}</SelectItem>{statuses.map((value) => <SelectItem key={value} value={value}>{enumLabel(value)}</SelectItem>)}</SelectContent></Select>
        <Select value={source} onValueChange={(value) => updateUrl({ source: value === "all" ? null : value, page: 1 })}><SelectTrigger aria-label={t("printing.source")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("printing.allSources")}</SelectItem>{SOURCES.map((value) => <SelectItem key={value} value={value}>{value === "counter" ? t("printing.sourceCounter") : t("printing.sourceApp")}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" onClick={() => query.refetch()}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />{t("common.refresh")}</Button>
      </div>

      {query.isPending ? <Skeleton className="h-96 rounded-2xl" /> : query.isError ? <ErrorPanel error={query.error} retry={() => query.refetch()} /> : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="w-16 p-3 text-start font-semibold">#</th>
                  <th scope="col" className="p-3 text-start font-semibold">{t("printing.customer")}</th>
                  <th scope="col" className="p-3 text-start font-semibold">{t("common.status")}</th>
                  <th scope="col" className="p-3 text-start font-semibold">{t("printing.value")}</th>
                  <th scope="col" className="p-3 text-start font-semibold">{t("printing.payment")}</th>
                  <th scope="col" className="p-3 text-start font-semibold">{t("support.assign")}</th>
                  <th scope="col" className="w-32 p-3 text-start font-semibold"><span className="sr-only">{t("common.actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {query.data.results.map((order) => {
                  const owes = Number(order.due_amount ?? 0) > 0;
                  return (
                    <tr key={order.id} className="border-t align-top hover:bg-muted/30">
                      <td className="p-3 font-mono tabular-nums">{order.id}</td>
                      <td className="min-w-[14rem] p-3">
                        <p className="break-words font-semibold" dir="auto">{order.user_name}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <SourceBadge source={order.source} />
                          {order.source === "counter" && order.customer_phone ? <bdi dir="ltr" className="text-xs text-muted-foreground">{order.customer_phone}</bdi> : null}
                        </div>
                      </td>
                      <td className="p-3"><StatusPill value={order.status} /></td>
                      <td className="p-3"><Money value={order.total_price} currency={order.currency} className="font-semibold" /></td>
                      <td className="p-3">
                        <div className="flex flex-col items-start gap-1.5">
                          <PaymentBadge order={order} />
                          {owes ? <span className="text-xs text-muted-foreground"><bdi>{t("printing.dueAmount")}: {formatMoney(order.due_amount, order.currency, locale)}</bdi></span> : null}
                        </div>
                      </td>
                      <td className="p-3">{order.assigned_to_name || "—"}</td>
                      <td className="p-3"><Button size="sm" variant="outline" onClick={() => { setSnapshot(order); setSelectedId(order.id); }}><ClipboardList />{t("common.details")}</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!query.data.results.length ? <div className="p-10 text-center text-muted-foreground">{t("common.noData")}</div> : null}
        </div>
      )}
      {query.data ? <Pagination page={page} pageSize={pageSize} count={query.data.count} onPage={(next) => updateUrl({ page: next })} onPageSize={(next) => updateUrl({ page_size: next, page: 1 })} /> : null}

      {selected ? <OrderDialog key={selected.id} order={selected} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}

export function PrintingPage() {
  const { t, enumLabel, locale } = useI18n();
  const currencyFilter = (clientSide: boolean): ManagerFilter[] => [{ param: "currency", label: t("printing.currencyFilter"), clientSide, options: CURRENCIES.map((value) => ({ value, label: enumLabel(value) })) }];
  return (
    <CapabilityGate capability={CAPABILITIES.printing}>
      <div className="space-y-6">
        <PageHeader
          title={t("printing.title")}
          description={t("printing.subtitle")}
          eyebrow={t("nav.operations")}
          actions={<Button asChild size="lg"><Link href={`/${locale}/dashboard/printing/counter`}><Plus />{t("printing.newCounterOrder")}</Link></Button>}
        />
        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="orders">{t("printing.orders")}</TabsTrigger><TabsTrigger value="pricing">{t("printing.pricing")}</TabsTrigger><TabsTrigger value="binding">{t("printing.binding")}</TabsTrigger><TabsTrigger value="locations">{t("printing.locations")}</TabsTrigger></TabsList>
          <TabsContent value="orders"><PrintOrdersPanel /></TabsContent>
          <TabsContent value="pricing"><ResourceManager resourceKey="printing-pricing-rules" columns={RESOURCE_COLUMNS["printing-pricing-rules"]} title={t("printing.pricing")} capability={CAPABILITIES.printing} filters={currencyFilter(false)} /></TabsContent>
          <TabsContent value="binding"><ResourceManager resourceKey="printing-binding-prices" columns={RESOURCE_COLUMNS["printing-binding-prices"]} title={t("printing.binding")} capability={CAPABILITIES.printing} filters={currencyFilter(true)} /></TabsContent>
          <TabsContent value="locations"><ResourceManager resourceKey="printing-pickup-locations" columns={RESOURCE_COLUMNS["printing-pickup-locations"]} title={t("printing.locations")} capability={CAPABILITIES.printing} /></TabsContent>
        </Tabs>
      </div>
    </CapabilityGate>
  );
}
