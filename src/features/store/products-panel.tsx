"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Pencil, Plus, RefreshCw, Search, Star, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Pagination } from "@/components/data-grid/pagination";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KEYS, useAllBrands, useAllCategories, usePrimaryImages, type StoreProduct, type StoreVariant } from "@/features/store/catalog-api";
import { ProductEditor, type EditorSection } from "@/features/store/product-editor";
import { ActiveBadge, StoreImage, useStoreErrorText } from "@/features/store/store-ui";
import { storePath } from "@/features/store/store-rules";
import { BrandsPanel, CategoriesPanel } from "@/features/store/taxonomy-panels";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection, unwrap } from "@/lib/api/browser-client";

const SECTIONS = ["products", "brands", "categories"] as const;
type Section = (typeof SECTIONS)[number];
const ALL = "all";

function resolveSection(value: string | null): Section {
  return (SECTIONS as readonly string[]).includes(value ?? "") ? (value as Section) : "products";
}
function resolveEditorSection(value: string | null): EditorSection {
  return value === "variants" || value === "images" ? value : "details";
}

function ProductsTable() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const errorText = useStoreErrorText();
  const search = searchParams.get("q") ?? "";
  const brand = searchParams.get("brand") ?? ALL;
  const category = searchParams.get("category") ?? ALL;
  const active = searchParams.get("active") ?? ALL;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("page_size") ?? 25) || 25));
  const productParam = searchParams.get("product");
  const variantParam = searchParams.get("variant");
  const [draft, setDraft] = useState(search);
  const debounced = useDebouncedValue(draft);
  const brands = useAllBrands();
  const categories = useAllCategories();
  const primary = usePrimaryImages();

  const updateUrl = useCallback((changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [name, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(name);
      else next.set(name, String(value));
    }
    router.replace(`?${next.toString()}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => { if (debounced !== search) updateUrl({ q: debounced, page: 1 }); }, [debounced, search, updateUrl]);

  // A link from the summary ("?variant=12") resolves to the product the variant belongs to, then opens its variants.
  const linkedVariant = useQuery({
    queryKey: [KEYS.variants, "one", variantParam],
    enabled: variantParam !== null && /^\d+$/u.test(variantParam),
    queryFn: async () => (await unwrap<StoreVariant>(apiFetch(storePath("variants", variantParam as string)))) as StoreVariant,
  });
  useEffect(() => {
    if (linkedVariant.data) updateUrl({ variant: null, product: linkedVariant.data.product, tab: "variants", focus: linkedVariant.data.id });
  }, [linkedVariant.data, updateUrl]);

  const query = useQuery({
    queryKey: [KEYS.products, "list", search, brand, category, active, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize), ordering: "sort_order,-created_at" });
      if (search.trim()) params.set("search", search.trim());
      if (/^\d+$/u.test(brand)) params.set("brand", brand);
      if (/^\d+$/u.test(category)) params.set("category", category);
      if (active === "yes") params.set("is_active", "true");
      if (active === "no") params.set("is_active", "false");
      return normalizeCollection<StoreProduct>(await apiFetch(`${storePath("products")}?${params}`));
    },
  });

  const brandName = (id: number | null) => (id === null ? "" : brands.data?.results.find((item) => item.id === id)?.name ?? "");
  const categoryName = (id: number) => categories.data?.results.find((item) => item.id === id)?.name ?? "";

  const toggle = useMutation({
    mutationFn: async (input: { id: number; active: boolean }) => { await apiFetch(storePath("products", input.id), { method: "PATCH", body: { is_active: input.active } }); },
    onSuccess() { void queryClient.invalidateQueries({ queryKey: [KEYS.products] }); void queryClient.invalidateQueries({ queryKey: ["store-summary"] }); },
    onError(error) { toast.error(errorText(error)); },
  });
  const remove = useMutation({
    mutationFn: async (id: number) => { await apiFetch(storePath("products", id), { method: "DELETE" }); },
    onSuccess() { toast.success(t("store.deleted")); for (const name of [KEYS.products, KEYS.brands, "store-summary"]) void queryClient.invalidateQueries({ queryKey: [name] }); },
    onError(error) { toast.error(errorText(error)); },
  });

  const filtered = search !== "" || brand !== ALL || category !== ALL || active !== ALL;
  const editorTarget: StoreProduct | number | "new" | null = productParam === "new" ? "new" : productParam && /^\d+$/u.test(productParam) ? query.data?.results.find((item) => item.id === Number(productParam)) ?? Number(productParam) : null;
  const focus = /^\d+$/u.test(searchParams.get("focus") ?? "") ? Number(searchParams.get("focus")) : null;

  return (
    <div className="space-y-4">
      <div className="glass-panel grid gap-3 rounded-2xl border p-3 md:grid-cols-[minmax(0,1fr)_11rem_11rem_10rem_auto]">
        <div className="relative min-w-0"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input className="ps-10" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t("store.product.search")} aria-label={t("common.search")} dir="auto" /></div>
        <Select value={brand} onValueChange={(value) => updateUrl({ brand: value === ALL ? null : value, page: 1 })}><SelectTrigger aria-label={t("store.product.brand")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>{t("store.product.allBrands")}</SelectItem>{(brands.data?.results ?? []).map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select>
        <Select value={category} onValueChange={(value) => updateUrl({ category: value === ALL ? null : value, page: 1 })}><SelectTrigger aria-label={t("store.product.category")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>{t("store.product.allCategories")}</SelectItem>{(categories.data?.results ?? []).map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select>
        <Select value={active} onValueChange={(value) => updateUrl({ active: value === ALL ? null : value, page: 1 })}><SelectTrigger aria-label={t("common.status")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>{t("store.product.anyState")}</SelectItem><SelectItem value="yes">{t("common.active")}</SelectItem><SelectItem value="no">{t("store.inactive")}</SelectItem></SelectContent></Select>
        <div className="flex gap-2">
          {filtered ? <Button variant="ghost" onClick={() => { setDraft(""); updateUrl({ q: null, brand: null, category: null, active: null, page: 1 }); }}>{t("printing.clearFilters")}</Button> : null}
          <Button variant="outline" size="icon" aria-label={t("common.refresh")} onClick={() => void query.refetch()}><RefreshCw className={query.isFetching ? "animate-spin" : ""} /></Button>
          <Button onClick={() => updateUrl({ product: "new", tab: null })}><Plus />{t("store.product.add")}</Button>
        </div>
      </div>

      {query.isPending ? <Skeleton className="h-96 rounded-2xl" /> : query.isError ? <ErrorPanel error={query.error} retry={() => void query.refetch()} /> : (
        <>
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>
                  <th scope="col" className="w-16 p-3" />
                  <th scope="col" className="p-3 text-start font-semibold">{t("store.field.name")}</th>
                  <th scope="col" className="p-3 text-start font-semibold">{t("store.product.prices")}</th>
                  <th scope="col" className="p-3 text-start font-semibold">{t("store.product.variants")}</th>
                  <th scope="col" className="p-3 text-start font-semibold">{t("store.product.sold")}</th>
                  <th scope="col" className="p-3 text-start font-semibold">{t("store.field.active")}</th>
                  <th scope="col" className="w-36 p-3"><span className="sr-only">{t("common.actions")}</span></th>
                </tr></thead>
                <tbody>
                  {query.data.results.map((product) => (
                    <tr key={product.id} className="border-t align-middle hover:bg-muted/30">
                      <td className="p-3"><StoreImage url={primary.data?.get(product.id)} className="size-12" /></td>
                      <td className="min-w-[14rem] p-3">
                        <button type="button" className="text-start font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" dir="auto" onClick={() => updateUrl({ product: product.id, tab: null })}>{product.name}</button>
                        <span className="block text-xs text-muted-foreground" dir="auto">{[categoryName(product.category), brandName(product.brand)].filter(Boolean).join(" • ")}</span>
                      </td>
                      <td className="p-3 text-xs"><span className="block"><Money value={product.price_syp} currency="SYP" /></span><span className="block"><Money value={product.price_usd} currency="USD" /></span></td>
                      <td className="p-3"><Button size="sm" variant="outline" onClick={() => updateUrl({ product: product.id, tab: "variants" })}><Boxes /><bdi className="tabular-nums">{product.variants_count}</bdi></Button></td>
                      <td className="p-3 text-xs text-muted-foreground"><span className="block tabular-nums"><bdi>{product.sold_count}</bdi> {t("store.product.soldUnits")}</span><span className="flex items-center gap-1"><Star className="size-3 text-amber-500" aria-hidden="true" /><bdi className="tabular-nums">{Number(product.rating_avg).toFixed(1)} ({product.rating_count})</bdi></span></td>
                      <td className="p-3"><div className="flex items-center gap-2"><Switch checked={product.is_active} disabled={toggle.isPending} aria-label={`${t("store.field.active")}: ${product.name}`} onCheckedChange={(next) => toggle.mutate({ id: product.id, active: next })} /><span className="hidden xl:inline"><ActiveBadge active={product.is_active} /></span></div></td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" aria-label={`${t("common.edit")} ${product.name}`} onClick={() => updateUrl({ product: product.id, tab: null })}><Pencil /></Button>
                          <ConfirmDialog trigger={<Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`${t("common.delete")} ${product.name}`}><Trash2 /></Button>} title={t("store.product.deleteTitle", { name: product.name })} description={t("store.product.deleteHint")} confirmLabel={t("common.delete")} cancelLabel={t("common.cancel")} onConfirm={() => remove.mutate(product.id)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!query.data.results.length ? <div className="p-10 text-center text-muted-foreground">{filtered ? t("store.noMatches") : t("store.product.empty")}</div> : null}
          </div>
          <Pagination page={page} pageSize={pageSize} count={query.data.count} onPage={(next) => updateUrl({ page: next })} onPageSize={(next) => updateUrl({ page_size: next, page: 1 })} />
        </>
      )}
      {editorTarget !== null ? <ProductEditor key={typeof editorTarget === "object" ? editorTarget.id : String(editorTarget)} target={editorTarget} section={resolveEditorSection(searchParams.get("tab"))} focusVariant={focus} onClose={() => updateUrl({ product: null, tab: null, focus: null })} /> : null}
    </div>
  );
}

export function CatalogPanel() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = resolveSection(searchParams.get("section"));
  const labels: Record<Section, string> = { products: t("store.catalog.products"), brands: t("store.catalog.brands"), categories: t("store.catalog.categories") };
  return (
    <div className="space-y-4">
      <Tabs value={section} onValueChange={(value) => router.replace(value === "products" ? "?" : `?section=${value}`, { scroll: false })}>
        <TabsList aria-label={t("store.catalog.sections")} className="h-auto flex-wrap justify-start">
          {SECTIONS.map((value) => <TabsTrigger key={value} value={value} className="px-4 py-2">{labels[value]}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      {section === "products" ? <ProductsTable /> : section === "brands" ? <BrandsPanel /> : <CategoriesPanel />}
    </div>
  );
}
