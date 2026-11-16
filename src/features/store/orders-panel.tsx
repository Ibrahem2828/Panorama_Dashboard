"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, ClipboardList, PackageCheck, RefreshCw, Search, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Pagination } from "@/components/data-grid/pagination";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cleanDate, dateRangeProblem } from "@/features/printing/order-filters";
import { signedRounding } from "@/features/printing/counter-order-rules";
import { Field, StoreStatusBadge, useStoreErrorText } from "@/features/store/store-ui";
import {
  ORDER_STATUSES, ORDER_TAB_ALL, REASON_MAX, actionLabelKey, forwardStatus, canCancelOrder, openOrderId, orderQuery, reasonProblem,
  resolveOrderStatus, sortedHistory, statusBody, statusLabelKey, storePath, type HistoryEntry, type StoreOrderStatus, type StoreSummary,
} from "@/features/store/store-rules";
import { useStoreSummary } from "@/features/store/use-store-summary";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useIdempotencyKey } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection, unwrap } from "@/lib/api/browser-client";
import { payloadSignature } from "@/lib/api/idempotency";
import { formatDate } from "@/lib/utils";

interface OrderItem {
  id: number;
  product: number;
  variant: number | null;
  name: string;
  brand_name: string;
  variant_label: string;
  sku: string;
  unit_price: string;
  quantity: number;
  line_total: string;
}

interface StoreOrder {
  id: number;
  code: string;
  status: string;
  customer: { id: number; full_name: string; phone_number: string };
  currency: string;
  subtotal: string;
  rounding_adjustment: string;
  total: string;
  notes: string;
  internal_notes?: string;
  cancel_reason: string;
  cancelled_by_customer: boolean;
  created_at: string;
  confirmed_at: string | null;
  ready_at: string | null;
  picked_up_at: string | null;
  cancelled_at: string | null;
  items?: OrderItem[];
  items_count?: number;
  history?: HistoryEntry[];
}

const ORDERS_KEY = "store-orders";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 break-words text-sm font-bold">{children}</div>
    </div>
  );
}

/** Reason dialog: a cancellation cannot be sent without one (the backend refuses it too). */
function CancelOrderDialog({ order, busy, onConfirm }: { order: StoreOrder; busy: boolean; onConfirm: (reason: string) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [show, setShow] = useState(false);
  const problem = reasonProblem(reason);
  const submit = () => {
    setShow(true);
    if (problem) return;
    onConfirm(reason.trim());
  };
  return (
    <>
      <Button type="button" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={busy} onClick={() => { setReason(""); setShow(false); setOpen(true); }}>
        <Ban />{t("store.orders.cancelOrder")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pe-10">
            <DialogTitle>{t("store.orders.cancelTitle", { code: order.code })}</DialogTitle>
            <DialogDescription>{t("store.orders.cancelHint")}</DialogDescription>
          </DialogHeader>
          <Field label={t("store.orders.cancelReason")} htmlFor="store-cancel-reason" error={show && problem ? (problem === "required" ? t("store.problem.reasonRequired") : t("store.problem.tooLong", { max: REASON_MAX })) : null}>
            <Textarea id="store-cancel-reason" value={reason} maxLength={REASON_MAX + 50} onChange={(event) => setReason(event.target.value)} aria-invalid={show && problem !== null} dir="auto" rows={3} />
          </Field>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("common.close")}</Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={submit}>{t("store.orders.cancelConfirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Timeline({ order }: { order: StoreOrder }) {
  const { t, locale } = useI18n();
  const history = sortedHistory(order.history);
  const label = (status: string) => t(statusLabelKey(status));
  // The backend already records the creation as the first trail entry (no previous status); then it is not drawn twice.
  const startsTrail = history.some((entry) => !entry.old_status);
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">{t("store.orders.timeline")}</CardTitle></CardHeader>
      <CardContent>
        <ol className="relative space-y-4 border-s ps-5">
          {startsTrail ? null : (
          <li className="relative">
            <span className="absolute -start-[1.65rem] top-1 size-3 rounded-full border-2 border-background bg-primary" aria-hidden="true" />
            <p className="text-sm font-semibold">{t("store.orders.created")}</p>
            <p className="text-xs text-muted-foreground"><bdi>{formatDate(order.created_at, locale)}</bdi></p>
          </li>
          )}
          {history.map((entry, index) => (
            <li key={`${entry.created_at}-${index}`} className="relative">
              <span className={`absolute -start-[1.65rem] top-1 size-3 rounded-full border-2 border-background ${entry.new_status === "cancelled" ? "bg-destructive" : "bg-primary"}`} aria-hidden="true" />
              <p className="text-sm font-semibold">{entry.old_status ? t("store.orders.moved", { from: label(entry.old_status), to: label(entry.new_status) }) : label(entry.new_status)}</p>
              <p className="text-xs text-muted-foreground"><bdi>{formatDate(entry.created_at, locale)}</bdi></p>
              {entry.note ? <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground" dir="auto">{entry.note}</p> : null}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function OrderDialog({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const errorText = useStoreErrorText();
  const key = useIdempotencyKey();
  const detail = useQuery({
    queryKey: [ORDERS_KEY, "one", orderId],
    queryFn: async () => (await unwrap<StoreOrder>(apiFetch(storePath("orders", orderId)))) as StoreOrder,
  });
  const [problem, setProblem] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: async (input: { status: StoreOrderStatus; reason?: string }) => {
      const body = statusBody(input.status, input.reason ?? "");
      return (await unwrap<StoreOrder>(apiFetch(storePath("orders", orderId, "status"), { method: "PATCH", body, idempotencyKey: key.get(payloadSignature("store-order-status", orderId, body)) }))) as StoreOrder;
    },
    onSuccess(updated, input) {
      key.reset();
      setProblem(null);
      queryClient.setQueryData([ORDERS_KEY, "one", orderId], updated);
      toast.success(input.status === "cancelled" ? t("store.orders.cancelled") : t("store.orders.statusSaved"));
      void queryClient.invalidateQueries({ queryKey: [ORDERS_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["store-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["quick-access"] });
    },
    onError(error) {
      key.reset();
      setProblem(errorText(error));
      // A stale screen (another employee moved the order first) is refreshed so the right buttons show.
      void queryClient.invalidateQueries({ queryKey: [ORDERS_KEY, "one", orderId] });
    },
  });

  const order = detail.data;
  const forward = order ? forwardStatus(order.status) : null;
  const rounding = order ? signedRounding(order.rounding_adjustment) : null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader className="pe-10">
          <DialogTitle className="flex flex-wrap items-center gap-2">{t("store.orders.details")} <bdi dir="ltr">{order?.code ?? `#${orderId}`}</bdi>{order ? <StoreStatusBadge status={order.status} /> : null}</DialogTitle>
          <DialogDescription>{t("store.orders.detailsHint")}</DialogDescription>
        </DialogHeader>
        {detail.isPending ? <Skeleton className="h-72 rounded-2xl" /> : detail.isError ? <ErrorPanel error={detail.error} retry={() => void detail.refetch()} /> : order ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Detail label={t("store.orders.customer")}>
                <Link href={`/${locale}/dashboard/users/${order.customer.id}`} className="font-semibold text-primary underline-offset-4 hover:underline" dir="auto">{order.customer.full_name || "—"}</Link>
              </Detail>
              <Detail label={t("store.orders.phone")}>{order.customer.phone_number ? <bdi dir="ltr">{order.customer.phone_number}</bdi> : "—"}</Detail>
              <Detail label={t("store.orders.placedAt")}><bdi>{formatDate(order.created_at, locale)}</bdi></Detail>
              <Detail label={t("store.orders.currency")}>{order.currency}</Detail>
            </div>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">{t("store.orders.items")}</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-sm">
                    <thead className="bg-muted/60 text-xs text-muted-foreground">
                      <tr>
                        <th scope="col" className="p-3 text-start font-semibold">{t("store.orders.product")}</th>
                        <th scope="col" className="p-3 text-start font-semibold">{t("store.orders.variant")}</th>
                        <th scope="col" className="p-3 text-start font-semibold">{t("store.orders.qty")}</th>
                        <th scope="col" className="p-3 text-start font-semibold">{t("store.orders.unitPrice")}</th>
                        <th scope="col" className="p-3 text-start font-semibold">{t("store.orders.lineTotal")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(order.items ?? []).map((item) => (
                        <tr key={item.id} className="border-t align-top">
                          <td className="min-w-[10rem] p-3"><span className="block font-semibold" dir="auto">{item.name}</span>{item.brand_name ? <span className="text-xs text-muted-foreground" dir="auto">{item.brand_name}</span> : null}</td>
                          <td className="p-3"><span dir="auto">{item.variant_label || "—"}</span>{item.sku ? <bdi dir="ltr" className="block text-xs text-muted-foreground">{item.sku}</bdi> : null}</td>
                          <td className="p-3 tabular-nums"><bdi>{item.quantity}</bdi></td>
                          <td className="p-3"><Money value={item.unit_price} currency={order.currency} /></td>
                          <td className="p-3"><Money value={item.line_total} currency={order.currency} className="font-semibold" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <dl className="space-y-1.5 border-t p-4 text-sm">
                  <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">{t("store.orders.subtotal")}</dt><dd><Money value={order.subtotal} currency={order.currency} /></dd></div>
                  {rounding ? <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">{t("store.orders.rounding")}</dt><dd><bdi dir="ltr" className="tabular-nums">{rounding}</bdi></dd></div> : null}
                  <div className="flex items-center justify-between gap-3 text-base font-black"><dt>{t("store.orders.total")}</dt><dd><Money value={order.total} currency={order.currency} /></dd></div>
                </dl>
                <p className="flex items-center gap-2 border-t bg-muted/30 px-4 py-3 text-sm font-semibold"><Wallet className="size-4 text-primary" aria-hidden="true" />{t("store.orders.cashOnPickup")}</p>
              </CardContent>
            </Card>

            {order.notes || order.cancel_reason || order.internal_notes ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {order.notes ? <Card><CardHeader className="pb-2"><CardTitle className="text-base">{t("store.orders.customerNotes")}</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap break-words text-sm text-muted-foreground" dir="auto">{order.notes}</CardContent></Card> : null}
                {order.cancel_reason ? (
                  <Card className="border-destructive/30"><CardHeader className="pb-2"><CardTitle className="text-base">{t("store.orders.cancelReason")}</CardTitle></CardHeader>
                    <CardContent className="space-y-1 text-sm"><p className="whitespace-pre-wrap break-words" dir="auto">{order.cancel_reason}</p>{order.cancelled_by_customer ? <p className="text-xs text-muted-foreground">{t("store.orders.byCustomer")}</p> : null}</CardContent></Card>
                ) : null}
                {order.internal_notes ? <Card><CardHeader className="pb-2"><CardTitle className="text-base">{t("store.orders.internalNotes")}</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap break-words text-sm text-muted-foreground" dir="auto">{order.internal_notes}</CardContent></Card> : null}
              </div>
            ) : null}

            <Timeline order={order} />

            {problem ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm font-medium text-destructive">{problem}</p> : null}

            <div className="flex flex-wrap gap-2">
              {forward ? (
                <ConfirmDialog
                  trigger={<Button disabled={change.isPending}>{forward === "picked_up" ? <PackageCheck /> : <CheckCircle2 />}{t(actionLabelKey(forward))}</Button>}
                  title={t("store.orders.confirmTitle", { action: t(actionLabelKey(forward)) })}
                  description={t(`store.orders.confirmHint.${forward}` as "store.orders.confirmHint.confirmed")}
                  confirmLabel={t(actionLabelKey(forward))}
                  cancelLabel={t("common.cancel")}
                  onConfirm={() => change.mutate({ status: forward })}
                />
              ) : null}
              {canCancelOrder(order.status) ? <CancelOrderDialog order={order} busy={change.isPending} onConfirm={(reason) => change.mutate({ status: "cancelled", reason })} /> : null}
              {!forward && !canCancelOrder(order.status) ? <p className="text-sm text-muted-foreground">{t("store.orders.final")}</p> : null}
            </div>
          </div>
        ) : null}
        <DialogFooter><Button variant="outline" onClick={onClose}>{t("common.close")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StoreOrdersPanel() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = resolveOrderStatus(searchParams.get("status"));
  const search = searchParams.get("q") ?? "";
  const from = cleanDate(searchParams.get("from"));
  const to = cleanDate(searchParams.get("to"));
  const rangeProblem = dateRangeProblem(from, to);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("page_size") ?? 25) || 25));
  const openId = openOrderId(searchParams);
  const [draft, setDraft] = useState(search);
  const debounced = useDebouncedValue(draft);
  const summary = useStoreSummary();

  const updateUrl = useCallback((changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [name, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(name);
      else next.set(name, String(value));
    }
    router.replace(`?${next.toString()}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    if (debounced !== search) updateUrl({ q: debounced, page: 1 });
  }, [debounced, search, updateUrl]);

  // The global 30 s refresh re-reads this list (and the open order); the counters on the tabs come from the summary.
  const query = useQuery({
    queryKey: [ORDERS_KEY, "list", status, search, from, to, page, pageSize],
    queryFn: async () => normalizeCollection<StoreOrder>(await apiFetch(`${storePath("orders")}?${orderQuery({ status, q: search, from, to, page, pageSize })}`)),
  });
  const filtered = status !== ORDER_TAB_ALL || search !== "" || from !== "" || to !== "";
  const counts: StoreSummary["orders_by_status"] = summary.data?.orders_by_status ?? {};
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <div className="space-y-4">
      <Tabs value={status} onValueChange={(value) => updateUrl({ status: value === ORDER_TAB_ALL ? null : value, page: 1 })}>
        <TabsList aria-label={t("store.orders.statusTabs")} className="h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value={ORDER_TAB_ALL} className="gap-2 px-3 py-2">{t("store.orders.all")}{summary.data ? <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums"><bdi>{total}</bdi></span> : null}</TabsTrigger>
          {ORDER_STATUSES.map((value) => (
            <TabsTrigger key={value} value={value} className="gap-2 px-3 py-2">
              {t(statusLabelKey(value))}
              {summary.data ? <span className={`rounded-full px-1.5 text-xs tabular-nums ${value === "pending" && (counts[value] ?? 0) > 0 ? "bg-amber-500/20 text-amber-800 dark:text-amber-200" : "bg-muted"}`}><bdi>{counts[value] ?? 0}</bdi></span> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="glass-panel grid gap-3 rounded-2xl border p-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input className="ps-10" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t("store.orders.search")} aria-label={t("common.search")} dir="auto" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="store-orders-from" className="text-xs text-muted-foreground">{t("printing.dateFrom")}</Label>
          <Input id="store-orders-from" type="date" dir="ltr" className="h-9 w-full md:w-40" value={from} max={to || undefined} aria-invalid={rangeProblem !== null} onChange={(event) => updateUrl({ from: cleanDate(event.target.value) || null, page: 1 })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="store-orders-to" className="text-xs text-muted-foreground">{t("printing.dateTo")}</Label>
          <Input id="store-orders-to" type="date" dir="ltr" className="h-9 w-full md:w-40" value={to} min={from || undefined} aria-invalid={rangeProblem !== null} onChange={(event) => updateUrl({ to: cleanDate(event.target.value) || null, page: 1 })} />
        </div>
        <div className="flex items-end gap-2">
          {filtered ? <Button variant="ghost" onClick={() => { setDraft(""); updateUrl({ status: null, q: null, from: null, to: null, page: 1 }); }}>{t("printing.clearFilters")}</Button> : null}
          <Button variant="outline" onClick={() => { void query.refetch(); void summary.refetch(); }}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />{t("common.refresh")}</Button>
        </div>
        {rangeProblem ? <p role="alert" className="text-xs font-medium text-destructive md:col-span-full">{t("printing.dateRangeOrder")}</p> : null}
      </div>

      {query.isPending ? <Skeleton className="h-96 rounded-2xl" /> : query.isError ? <ErrorPanel error={query.error} retry={() => void query.refetch()} /> : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="p-3 text-start font-semibold">{t("store.orders.code")}</th>
                    <th scope="col" className="p-3 text-start font-semibold">{t("store.orders.customer")}</th>
                    <th scope="col" className="p-3 text-start font-semibold">{t("common.status")}</th>
                    <th scope="col" className="p-3 text-start font-semibold">{t("store.orders.itemsCount")}</th>
                    <th scope="col" className="p-3 text-start font-semibold">{t("store.orders.total")}</th>
                    <th scope="col" className="p-3 text-start font-semibold">{t("store.orders.placedAt")}</th>
                    <th scope="col" className="w-28 p-3"><span className="sr-only">{t("common.actions")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.results.map((order) => (
                    <tr key={order.id} className={`border-t align-top hover:bg-muted/30 ${order.status === "pending" ? "bg-amber-500/5" : ""}`}>
                      <td className="p-3 font-mono"><bdi dir="ltr">{order.code}</bdi></td>
                      <td className="min-w-[12rem] p-3"><span className="block font-semibold" dir="auto">{order.customer.full_name || "—"}</span><bdi dir="ltr" className="text-xs text-muted-foreground">{order.customer.phone_number}</bdi></td>
                      <td className="p-3"><StoreStatusBadge status={order.status} /></td>
                      <td className="p-3 tabular-nums"><bdi>{order.items_count ?? "—"}</bdi></td>
                      <td className="p-3"><Money value={order.total} currency={order.currency} className="font-semibold" /></td>
                      <td className="p-3 text-xs text-muted-foreground"><bdi>{formatDate(order.created_at, locale)}</bdi></td>
                      <td className="p-3"><Button size="sm" variant="outline" onClick={() => updateUrl({ order: order.id, highlight: null })}><ClipboardList />{t("common.details")}</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <ul className="space-y-3 md:hidden">
            {query.data.results.map((order) => (
              <li key={order.id}>
                <button type="button" onClick={() => updateUrl({ order: order.id, highlight: null })} className={`w-full rounded-2xl border p-4 text-start transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${order.status === "pending" ? "border-amber-500/40 bg-amber-500/5" : "bg-card"}`}>
                  <span className="flex items-center justify-between gap-2"><bdi dir="ltr" className="font-mono font-bold">{order.code}</bdi><StoreStatusBadge status={order.status} /></span>
                  <span className="mt-2 block font-semibold" dir="auto">{order.customer.full_name || "—"}</span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground"><bdi>{formatDate(order.created_at, locale)}</bdi><Money value={order.total} currency={order.currency} className="text-sm font-bold text-foreground" /></span>
                </button>
              </li>
            ))}
          </ul>
          {!query.data.results.length ? <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">{filtered ? t("store.orders.noMatches") : t("store.orders.empty")}</div> : null}
          <Pagination page={page} pageSize={pageSize} count={query.data.count} onPage={(next) => updateUrl({ page: next })} onPageSize={(next) => updateUrl({ page_size: next, page: 1 })} />
        </>
      )}

      {openId !== null ? <OrderDialog key={openId} orderId={openId} onClose={() => updateUrl({ order: null, highlight: null })} /> : null}
    </div>
  );
}
