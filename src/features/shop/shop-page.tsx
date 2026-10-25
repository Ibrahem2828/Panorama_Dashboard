"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Receipt, Search, ShoppingCart, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useIdempotencyKey } from "@/hooks/use-idempotency-key";
import { payloadSignature } from "@/lib/api/idempotency";
import { PAYMENT_METHODS, type PaymentMethod } from "@/features/finance/finance-rules";
import { cartTotal, changeQuantity, type CartLine, type SellableItem } from "@/features/shop/shop-rules";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection, unwrap } from "@/lib/api/browser-client";
import { CAPABILITIES } from "@/lib/auth/capabilities";

interface Sale { id: number; sold_at: string; currency: string; total: string; payment_method: string; customer_name: string; lines: { id: number; name: string; quantity: string; line_total: string }[] }
interface Report { totals_by_currency: Record<string, { total: string | number; sales: number }>; top_items: { item: number; name: string; currency: string; quantity: string | number; revenue: string | number }[] }

/** Quick stationery sale: pick items, set quantities, take payment. The sale takes the items off the shelf. */
function QuickSale() {
  const { t, enumLabel } = useI18n();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [customer, setCustomer] = useState("");
  const key = useIdempotencyKey();

  const items = useQuery({
    queryKey: ["shop-items", term],
    queryFn: async () => normalizeCollection<SellableItem>(await apiFetch(`/api/v1/dashboard/shop/items/?page_size=60${term ? `&search=${encodeURIComponent(term)}` : ""}`)),
  });
  const total = useMemo(() => cartTotal(cart), [cart]);
  const currency = cart[0]?.item.currency ?? "SYP";
  const mixed = cart.some((line) => line.item.currency !== currency);

  const sell = useMutation({
    mutationFn: async () => {
      const body = { lines: cart.map((line) => ({ item: line.item.id, quantity: String(line.quantity) })), payment_method: method, customer_name: customer };
      return unwrap(apiFetch<{ data: Sale }>("/api/v1/dashboard/shop/sales/create/", { method: "POST", body, idempotencyKey: key.get(payloadSignature("shop-sale", body)) }));
    },
    onSuccess: async () => {
      key.reset();
      toast.success(t("shop.sold"));
      setCart([]); setCustomer("");
      await queryClient.invalidateQueries({ queryKey: ["shop-items"] });
      await queryClient.invalidateQueries({ queryKey: ["shop-sales"] });
      await queryClient.invalidateQueries({ queryKey: ["finance-stock"] });
    },
    onError: () => toast.error(t("shop.failed")),
  });

  const add = (item: SellableItem) => setCart((current) => changeQuantity(current, item, 1));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("shop.items")}</CardTitle>
          <div className="relative"><Search className="absolute start-3 top-3 size-4 text-muted-foreground" /><Input className="ps-9" placeholder={t("shop.search")} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {items.isLoading ? <Skeleton className="h-24 w-full sm:col-span-3" /> : null}
          {items.error ? <ErrorPanel error={items.error} retry={() => void items.refetch()} /> : null}
          {!items.isLoading && (items.data?.results.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground sm:col-span-3">{t("shop.noItems")}</p> : null}
          {items.data?.results.map((item) => {
            const out = Number(item.quantity) <= 0;
            return (
              <button key={item.id} type="button" disabled={out} onClick={() => add(item)} className="rounded-lg border p-3 text-start transition-colors hover:bg-muted disabled:opacity-50">
                <p className="truncate font-semibold" dir="auto">{item.name}</p>
                <p className="flex items-center justify-between text-sm"><Money value={item.sale_price} currency={item.currency} /><span className="text-xs text-muted-foreground">{out ? t("shop.outOfStock") : t("shop.left", { count: item.quantity })}</span></p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ShoppingCart className="size-4" />{t("shop.cart")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {cart.length === 0 ? <p className="text-sm text-muted-foreground">{t("shop.cartEmpty")}</p> : cart.map((line) => (
            <div key={line.item.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate" dir="auto">{line.item.name}</span>
              <Button size="icon" variant="outline" className="size-7" aria-label={t("shop.less")} onClick={() => setCart((current) => changeQuantity(current, line.item, -1))}><Minus className="size-3" /></Button>
              <bdi className="w-8 text-center font-bold">{line.quantity}</bdi>
              <Button size="icon" variant="outline" className="size-7" aria-label={t("shop.more")} onClick={() => setCart((current) => changeQuantity(current, line.item, 1))}><Plus className="size-3" /></Button>
              <Button size="icon" variant="ghost" className="size-7" aria-label={t("shop.remove")} onClick={() => setCart((current) => current.filter((entry) => entry.item.id !== line.item.id))}><Trash2 className="size-3" /></Button>
            </div>
          ))}
          <div className="flex items-center justify-between border-t pt-3 text-base font-bold"><span>{t("shop.total")}</span><Money value={total} currency={currency} /></div>
          {mixed ? <p className="text-xs text-destructive">{t("shop.mixedCurrency")}</p> : null}
          <Input placeholder={t("shop.customer")} value={customer} onChange={(event) => setCustomer(event.target.value)} maxLength={150} />
          <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PAYMENT_METHODS.map((value) => <SelectItem key={value} value={value}>{enumLabel(value)}</SelectItem>)}</SelectContent>
          </Select>
          <Button className="w-full" disabled={cart.length === 0 || mixed} isLoading={sell.isPending} onClick={() => sell.mutate()}><Receipt />{t("shop.sell")}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SalesReport() {
  const { t, locale } = useI18n();
  const month = new Date();
  const from = new Date(month.getFullYear(), month.getMonth(), 1).toISOString().slice(0, 10);
  const report = useQuery({ queryKey: ["shop-report", from], queryFn: async () => unwrap(apiFetch<{ data: Report }>(`/api/v1/dashboard/shop/sales/report/?from=${from}`)) });
  const sales = useQuery({ queryKey: ["shop-sales", from], queryFn: async () => normalizeCollection<Sale>(await apiFetch(`/api/v1/dashboard/shop/sales/?from=${from}&page_size=50`)) });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">{t("shop.reportTitle")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {report.isLoading ? <Skeleton className="h-20 w-full" /> : null}
          {report.error ? <ErrorPanel error={report.error} retry={() => void report.refetch()} /> : null}
          {Object.entries(report.data?.totals_by_currency ?? {}).map(([currency, row]) => (
            <div key={currency} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"><span>{t("shop.salesCount", { count: row.sales })}</span><Money value={row.total} currency={currency} /></div>
          ))}
          <p className="pt-2 text-xs font-semibold text-muted-foreground">{t("shop.topItems")}</p>
          <ul className="space-y-1 text-sm">{report.data?.top_items.map((row) => <li key={`${row.item}-${row.currency}`} className="flex justify-between gap-2"><span className="truncate" dir="auto">{row.name}</span><span className="shrink-0"><bdi>{row.quantity}</bdi> · <Money value={row.revenue} currency={row.currency} /></span></li>)}</ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">{t("shop.recent")}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {sales.data?.results.map((sale) => (
            <div key={sale.id} className="rounded-lg border p-2 text-sm">
              <div className="flex items-center justify-between"><bdi className="font-semibold">#{sale.id}</bdi><Money value={sale.total} currency={sale.currency} /></div>
              <p className="text-xs text-muted-foreground">{new Date(sale.sold_at).toLocaleString(locale === "ar" ? "ar" : "en")}{sale.customer_name ? ` · ${sale.customer_name}` : ""}</p>
              <p className="truncate text-xs" dir="auto">{sale.lines.map((line) => `${line.name} ×${line.quantity}`).join("، ")}</p>
            </div>
          ))}
          {sales.data && sales.data.results.length === 0 ? <p className="text-sm text-muted-foreground">{t("shop.noSales")}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function ShopPage() {
  const { t } = useI18n();
  return (
    <CapabilityGate capability={CAPABILITIES.printing}>
      <div className="space-y-6">
        <PageHeader title={t("shop.title")} description={t("shop.subtitle")} eyebrow={t("nav.operations")} />
        <Tabs defaultValue="sell" className="space-y-4">
          <TabsList><TabsTrigger value="sell">{t("shop.tabSell")}</TabsTrigger><TabsTrigger value="report">{t("shop.tabReport")}</TabsTrigger></TabsList>
          <TabsContent value="sell"><QuickSale /></TabsContent>
          <TabsContent value="report"><SalesReport /></TabsContent>
        </Tabs>
      </div>
    </CapabilityGate>
  );
}
