"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, MinusCircle, Pencil, Plus, RefreshCw, Search, ShoppingCart, SlidersHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Pagination } from "@/components/data-grid/pagination";
import { CapabilityGate } from "@/components/feedback/capability-gate";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { ResourceFormDialog, type FormBody } from "@/components/forms/resource-form-dialog";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { RESOURCE_DEFINITIONS } from "@/contracts/generated/resource-definitions";
import type { ResourceDefinition } from "@/contracts/types";
import {
  FINANCE_CURRENCIES, FINANCE_PATHS, INVENTORY_CATEGORIES, formatQuantity, formatRate, groupByCategory, movementBody, purchaseTotal, quantityAfter,
  stockHistoryPath, stockMovementsPath, formatMoney, type AdjustmentDirection, type FinanceCurrency, type MovementType,
} from "@/features/finance/finance-rules";
import { createResource, deleteResource, updateResource, type EntityRecord } from "@/features/resources/resource-api";
import { formSpecsFor } from "@/features/resources/resource-form-policy";
import { useCan } from "@/features/session";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useIdempotencyKey, useMutationError } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";
import { apiErrorText } from "@/lib/api/error-message";
import { payloadSignature } from "@/lib/api/idempotency";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { formatDate } from "@/lib/utils";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";

interface StockItem {
  id: number;
  name: string;
  category: string;
  unit: string;
  sku: string;
  quantity: string;
  reorder_level: string;
  unit_cost: string;
  currency: string;
  stock_value: string;
  consumption_key?: string;
  consumption_per_use?: string;
  pending_consumption?: string;
  is_low: boolean;
  location: string;
  is_active: boolean;
}
interface Movement { id: number; order?: number | null; movement_type: string; quantity: string; quantity_after: string; unit_cost: string | null; currency: string; note: string; created_by_name: string | null; created_at: string }

const ALL = "all";
const PAGE_SIZE = 100;
const INVENTORY = RESOURCE_DEFINITIONS["finance-inventory-items"] as ResourceDefinition;
const MOVEMENT_ICON = { purchase: ShoppingCart, usage: MinusCircle, waste: Trash2, adjustment: SlidersHorizontal } as const;

function useCategoryLabel() {
  const { t } = useI18n();
  return (category: string) => t(`finance.stock.category.${(INVENTORY_CATEGORIES as readonly string[]).includes(category) ? category : "other"}` as MessageKey);
}

/** One stock movement (purchase, usage, waste, count) with a preview of the resulting quantity. */
function MovementDialog({ item, type, onClose }: { item: StockItem; type: MovementType; onClose: () => void }) {
  const { t, enumLabel, locale } = useI18n();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState("");
  const [direction, setDirection] = useState<AdjustmentDirection>("increase");
  const [unitCost, setUnitCost] = useState(Number(item.unit_cost) > 0 ? String(item.unit_cost) : "");
  const [currency, setCurrency] = useState<FinanceCurrency>(item.currency === "USD" ? "USD" : "SYP");
  const [recordExpense, setRecordExpense] = useState(false);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const keys = useIdempotencyKey();
  const keyError = useMutationError(keys);
  const body = movementBody({ type, quantity, direction, unitCost, currency, note, recordExpense });
  const quantityBody = movementBody({ type: type === "purchase" ? "usage" : type, quantity, direction });
  const quantityOk = quantityBody !== null;
  const costOk = type !== "purchase" || movementBody({ type, quantity: "1", unitCost }) !== null;
  const afterValue = quantityBody ? quantityAfter(item.quantity, { ...quantityBody, movement_type: type }) : null;
  const total = type === "purchase" && quantityOk && costOk ? purchaseTotal(quantity, unitCost) : null;

  const save = useMutation({
    mutationFn: () => apiFetch(stockMovementsPath(item.id), { method: "POST", body: body!, idempotencyKey: keys.get(payloadSignature("movement", item.id, body)) }),
    onSuccess() {
      keys.reset();
      toast.success(t("finance.move.done"));
      void queryClient.invalidateQueries({ queryKey: ["finance-stock"] });
      void queryClient.invalidateQueries({ queryKey: ["finance-stock-history", item.id] });
      void queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "finance-expenses"] });
      onClose();
    },
    onError: keyError,
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !save.isPending) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`finance.move.title.${type}` as MessageKey, { name: item.name })}</DialogTitle>
          <DialogDescription>{t(`finance.move.help.${type}` as MessageKey)}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); setTouched(true); if (body && !save.isPending) save.mutate(); }}>
          <p className="text-sm text-muted-foreground">{t("finance.move.current", { quantity: `${formatQuantity(item.quantity, locale)} ${item.unit}` })}</p>
          {type === "adjustment" ? (
            <div className="space-y-2">
              <Label>{t("finance.move.direction")}</Label>
              <div role="group" aria-label={t("finance.move.direction")} className="inline-flex rounded-lg border bg-muted/40 p-1">
                {(["increase", "decrease"] as const).map((value) => (
                  <Button key={value} type="button" size="sm" variant={direction === value ? "default" : "ghost"} aria-pressed={direction === value} onClick={() => setDirection(value)}>{t(`finance.move.${value}` as MessageKey)}</Button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="move-quantity">{t("finance.move.quantity", { unit: item.unit })}<span className="ms-1 text-destructive" aria-hidden="true">*</span></Label>
            <Input id="move-quantity" dir="ltr" className="text-start" inputMode="decimal" autoComplete="off" value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-invalid={touched && !quantityOk ? true : undefined} aria-required />
            {touched && !quantityOk ? <p role="alert" className="text-xs font-medium text-destructive">{t("finance.move.invalidQuantity")}</p> : null}
            {afterValue !== null ? <p className="text-xs text-muted-foreground">{t("finance.move.after", { quantity: `${formatQuantity(afterValue, locale)} ${item.unit}` })}</p> : null}
          </div>
          {type === "purchase" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="move-cost">{t("finance.move.unitCost")}<span className="ms-1 text-destructive" aria-hidden="true">*</span></Label>
                  <Input id="move-cost" dir="ltr" className="text-start" inputMode="decimal" autoComplete="off" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} aria-invalid={touched && !costOk ? true : undefined} aria-required />
                  {touched && !costOk ? <p role="alert" className="text-xs font-medium text-destructive">{t("finance.move.invalidCost")}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="move-currency">{t("finance.move.currency")}</Label>
                  <Select value={currency} onValueChange={(value) => setCurrency(value as FinanceCurrency)}>
                    <SelectTrigger id="move-currency"><SelectValue /></SelectTrigger>
                    <SelectContent>{FINANCE_CURRENCIES.map((code) => <SelectItem key={code} value={code}>{enumLabel(code)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {total !== null ? <p className="text-sm font-semibold">{t("finance.move.total", { total: formatMoney(total, currency, locale) })}</p> : null}
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div><Label htmlFor="move-expense">{t("finance.move.recordExpense")}</Label><p className="text-xs text-muted-foreground">{t("finance.move.recordExpenseHint")}</p></div>
                <Switch id="move-expense" checked={recordExpense} onCheckedChange={setRecordExpense} />
              </div>
            </>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="move-note">{t("finance.move.note")}</Label>
            <Input id="move-note" value={note} maxLength={255} onChange={(event) => setNote(event.target.value)} />
          </div>
          {save.error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{apiErrorText(save.error, t)}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>{t("common.cancel")}</Button>
            <Button type="submit" isLoading={save.isPending}>{t("finance.move.submit")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Drawer with the movement ledger of one item (GET stock/{id}/movement-history/). */
function HistoryDrawer({ item, onClose }: { item: StockItem | null; onClose: () => void }) {
  const { t, enumLabel, locale } = useI18n();
  const history = useQuery({
    queryKey: ["finance-stock-history", item?.id],
    enabled: Boolean(item),
    queryFn: async () => (await normalizeCollection<Movement>(await apiFetch(stockHistoryPath(item!.id)))).results,
  });
  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t("finance.stock.historyTitle", { name: item?.name ?? "" })}</SheetTitle>
          <SheetDescription>{t("finance.stock.history")}</SheetDescription>
        </SheetHeader>
        <div className="mt-5">
          {history.isPending ? <Skeleton className="h-40 rounded-xl" /> : history.isError ? <ErrorPanel error={history.error} retry={() => void history.refetch()} /> : history.data.length ? (
            <ol className="space-y-3 border-s ps-4">
              {history.data.map((move) => {
                const signed = Number(move.quantity);
                return (
                  <li key={move.id} className="relative">
                    <span className="absolute -start-[1.3rem] top-1.5 size-2.5 rounded-full bg-primary" aria-hidden="true" />
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      <span>{enumLabel(move.movement_type)}</span>
                      <bdi className="tabular-nums">{signed > 0 && move.movement_type === "adjustment" ? "+" : ""}{formatQuantity(move.quantity, locale)}</bdi>
                      {move.unit_cost ? <span className="text-xs font-normal text-muted-foreground"><Money value={move.unit_cost} currency={move.currency} /></span> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(move.created_at, locale)}
                      {move.created_by_name ? ` · ${t("finance.stock.historyBy", { name: move.created_by_name })}` : ""}
                      {` · ${t("finance.stock.historyAfter", { quantity: formatQuantity(move.quantity_after, locale) })}`}
                    </div>
                    {move.order ? <Link href={`/${locale}/dashboard/printing?search=${move.order}`} className="mt-1 inline-block text-xs font-semibold text-primary underline-offset-2 hover:underline">{t("finance.stock.historyOrder", { id: move.order })}</Link> : null}
                    {move.note ? <p className="mt-1 text-xs">{move.note}</p> : null}
                  </li>
                );
              })}
            </ol>
          ) : <p className="text-sm text-muted-foreground">{t("finance.stock.historyEmpty")}</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Create / edit a stock item definition (finance managers). Quantities are never edited here. */
function ItemFormDialog({ item, onClose }: { item: StockItem | "new"; onClose: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const editing = item !== "new";
  const keys = useIdempotencyKey();
  const keyError = useMutationError(keys);
  const save = useMutation({
    mutationFn: (body: FormBody) => (editing
      ? updateResource(INVENTORY, item.id, body as Record<string, unknown>, keys.get(payloadSignature("update", item.id, body)))
      : createResource(INVENTORY, body as Record<string, unknown>, keys.get(payloadSignature("create", body)))),
    onSuccess() {
      keys.reset();
      toast.success(t("common.success"));
      void queryClient.invalidateQueries({ queryKey: ["finance-stock"] });
      void queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
      onClose();
    },
    onError: keyError,
  });
  return (
    <ResourceFormDialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={t(editing ? "finance.stock.formTitleEdit" : "finance.stock.formTitleCreate")}
      description={editing ? item.name : undefined}
      specs={formSpecsFor("finance-inventory-items", editing ? "edit" : "create")}
      mode={editing ? "edit" : "create"}
      entity={editing ? (item as unknown as EntityRecord) : null}
      pending={save.isPending}
      serverError={save.error}
      onSubmit={(body) => save.mutate(body)}
    />
  );
}

/** المخزون: items grouped by category with low-stock badges, movements (purchase, usage, waste, count) and a history drawer. */
export function StockPage() {
  const { t, enumLabel, locale } = useI18n();
  const categoryLabel = useCategoryLabel();
  const queryClient = useQueryClient();
  const canDefine = useCan(CAPABILITIES.finance);
  const [category, setCategory] = useState<string>(ALL);
  const [searchDraft, setSearchDraft] = useState("");
  const search = useDebouncedValue(searchDraft);
  const [pageState, setPageState] = useState({ key: "", page: 1 });
  const filterKey = `${category}|${search}`;
  const page = pageState.key === filterKey ? pageState.page : 1;
  const [movement, setMovement] = useState<{ item: StockItem; type: MovementType } | null>(null);
  const [history, setHistory] = useState<StockItem | null>(null);
  const [form, setForm] = useState<StockItem | "new" | null>(null);

  const query = useQuery({
    queryKey: ["finance-stock", category, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (category !== ALL) params.set("category", category);
      if (search) params.set("search", search);
      return normalizeCollection<StockItem>(await apiFetch(`${FINANCE_PATHS.stock}?${params}`));
    },
  });

  const removeKey = useIdempotencyKey();
  const removeError = useMutationError(removeKey);
  const remove = useMutation({
    mutationFn: (item: StockItem) => deleteResource(INVENTORY, item.id, removeKey.get(payloadSignature("delete", item.id))),
    onSuccess() { removeKey.reset(); toast.success(t("common.success")); void queryClient.invalidateQueries({ queryKey: ["finance-stock"] }); void queryClient.invalidateQueries({ queryKey: ["finance-summary"] }); },
    onError: removeError,
  });

  const groups = query.data ? groupByCategory(query.data.results) : [];
  const actionButton = (item: StockItem, type: MovementType) => {
    const Icon = MOVEMENT_ICON[type];
    return <Button key={type} size="sm" variant="outline" onClick={() => setMovement({ item, type })}><Icon />{t(`finance.move.${type}` as MessageKey)}</Button>;
  };

  return (
    <CapabilityGate capability={CAPABILITIES.printing}>
      <div className="space-y-6">
        <PageHeader
          title={t("finance.stock.title")}
          description={t("finance.stock.subtitle")}
          eyebrow={t("nav.finance")}
          actions={<>
            <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />{t("common.refresh")}</Button>
            {canDefine ? <Button onClick={() => setForm("new")}><Plus />{t("finance.stock.add")}</Button> : null}
          </>}
        />
        <div className="glass-panel flex flex-col gap-3 rounded-2xl border p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <div role="group" aria-label={t("finance.stock.categories")} className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
            {[ALL, ...INVENTORY_CATEGORIES].map((value) => (
              <Button key={value} type="button" size="sm" variant={category === value ? "default" : "ghost"} aria-pressed={category === value} onClick={() => setCategory(value)}>
                {value === ALL ? t("finance.stock.all") : categoryLabel(value)}
              </Button>
            ))}
          </div>
          <div className="relative lg:w-80">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={t("finance.stock.search")} aria-label={t("common.search")} className="h-9 ps-10" />
          </div>
        </div>

        {query.isPending ? <Skeleton className="h-96 rounded-2xl" /> : query.isError ? <ErrorPanel error={query.error} retry={() => void query.refetch()} /> : (
          <>
            {groups.length ? groups.map((group) => (
              <section key={group.category} aria-label={categoryLabel(group.category)} className="space-y-2">
                {category === ALL ? <h2 className="text-sm font-black text-muted-foreground">{categoryLabel(group.category)}</h2> : null}
                <div className="overflow-hidden rounded-xl border bg-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/55 text-xs text-muted-foreground">
                        <tr>{(["finance.stock.item", "finance.stock.quantity", "finance.stock.reorder", "finance.stock.unitCost", "finance.stock.value", "finance.stock.location", "common.actions"] as const).map((key) => <th key={key} className="whitespace-nowrap p-3 text-start font-bold">{t(key)}</th>)}</tr>
                      </thead>
                      <tbody>
                        {group.items.map((item) => (
                          <tr key={item.id} className="border-t hover:bg-muted/30">
                            <td className="min-w-[13rem] p-3">
                              <span className="font-semibold">{item.name}</span>
                              {item.sku ? <bdi className="block text-xs text-muted-foreground" dir="ltr">{item.sku}</bdi> : null}
                              {!item.is_active ? <Badge variant="outline" className="mt-1">{t("finance.stock.inactive")}</Badge> : null}
                              {item.consumption_key ? <p className="mt-1 max-w-[16rem] text-xs leading-5 text-muted-foreground"><bdi>{t("finance.stock.autoRule", { kind: enumLabel(item.consumption_key), use: formatRate(item.consumption_per_use, locale) })}</bdi></p> : null}
                            </td>
                            <td className="p-3">
                              <span className="font-bold tabular-nums">{formatQuantity(item.quantity, locale)}</span> <span className="text-muted-foreground">{item.unit}</span>
                              {item.is_low ? <Badge variant="warning" className="ms-2 whitespace-nowrap">{t("finance.stock.low")}</Badge> : null}
                            </td>
                            <td className="p-3 tabular-nums">{formatQuantity(item.reorder_level, locale)}</td>
                            <td className="p-3"><Money value={item.unit_cost} currency={item.currency} /></td>
                            <td className="p-3"><Money value={item.stock_value} currency={item.currency} /></td>
                            <td className="p-3">{item.location || "—"}</td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-2">
                                {(["purchase", "usage", "waste", "adjustment"] as const).map((type) => actionButton(item, type))}
                                <Button size="sm" variant="ghost" onClick={() => setHistory(item)}><History />{t("finance.stock.history")}</Button>
                                {canDefine ? <Button size="sm" variant="ghost" onClick={() => setForm(item)}><Pencil />{t("common.edit")}</Button> : null}
                                {canDefine ? (
                                  <ConfirmDialog
                                    trigger={<Button size="sm" variant="ghost" className="text-destructive" aria-label={t("common.delete")} disabled={remove.isPending}><Trash2 /></Button>}
                                    title={t("common.confirmDelete")}
                                    description={t("resource.deleteDescription", { name: item.name })}
                                    confirmLabel={t("common.delete")}
                                    cancelLabel={t("common.cancel")}
                                    onConfirm={() => remove.mutate(item)}
                                  />
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )) : <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">{t("finance.stock.empty")}</div>}
            <Pagination page={page} pageSize={PAGE_SIZE} count={query.data.count} onPage={(next) => setPageState({ key: filterKey, page: next })} onPageSize={() => undefined} />
          </>
        )}

        {movement ? <MovementDialog key={`${movement.item.id}-${movement.type}`} item={movement.item} type={movement.type} onClose={() => setMovement(null)} /> : null}
        <HistoryDrawer item={history} onClose={() => setHistory(null)} />
        {form ? <ItemFormDialog key={form === "new" ? "new" : form.id} item={form} onClose={() => setForm(null)} /> : null}
      </div>
    </CapabilityGate>
  );
}
