"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorPanel } from "@/components/feedback/error-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { KEYS, useAllBrands, useAllCategories, type StoreProduct } from "@/features/store/catalog-api";
import { BrandDialog, CategoryDialog } from "@/features/store/taxonomy-panels";
import { ImagesSection } from "@/features/store/images-section";
import { Field, useServerFieldErrors, useStoreErrorText } from "@/features/store/store-ui";
import {
  EMPTY_PRODUCT, PRODUCT_NAME_MAX, SPEC_LABEL_MAX, SPEC_MAX_ROWS, SPEC_VALUE_MAX, hasNoPrice, productBody, storePath, validateProduct, type ProductForm,
} from "@/features/store/store-rules";
import { VariantsSection } from "@/features/store/variants-section";
import { useI18n } from "@/i18n/provider";
import { apiFetch, unwrap } from "@/lib/api/browser-client";

const NONE = "none";
export type EditorSection = "details" | "variants" | "images";

function fromProduct(product: StoreProduct): ProductForm {
  return {
    name: product.name, description: product.description, brand: product.brand === null ? "" : String(product.brand), category: String(product.category),
    specs: product.specs.map((row) => ({ label: row.label, value: row.value })), priceSyp: product.price_syp ?? "", priceUsd: product.price_usd ?? "",
    isActive: product.is_active, sortOrder: String(product.sort_order),
  };
}

function DetailsForm({ product, onSaved }: { product: StoreProduct | null; onSaved: (saved: StoreProduct, created: boolean) => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const errorText = useStoreErrorText();
  const serverFields = useServerFieldErrors();
  const brands = useAllBrands();
  const categories = useAllCategories();
  const [form, setForm] = useState<ProductForm>(product ? fromProduct(product) : EMPTY_PRODUCT);
  const [creating, setCreating] = useState<"brand" | "category" | null>(null);
  // A brand/category made from this form is picked only once the refreshed list contains it (a select cannot hold a value it has no option for).
  const [pendingPick, setPendingPick] = useState<{ kind: "brand" | "category"; id: string } | null>(null);
  const [show, setShow] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const problems = validateProduct(form);
  const set = (patch: Partial<ProductForm>) => setForm((current) => ({ ...current, ...patch }));
  const priceError = (problem: string | undefined) => (problem ? t(`store.problem.price.${problem}` as "store.problem.price.invalid") : null);

  const save = useMutation({
    mutationFn: async () => (await unwrap<StoreProduct>(apiFetch(product ? storePath("products", product.id) : storePath("products"), { method: product ? "PATCH" : "POST", body: productBody(form) }))) as StoreProduct,
    onSuccess(saved) {
      toast.success(t("store.saved"));
      for (const name of [KEYS.products, KEYS.brands, "store-summary"]) void queryClient.invalidateQueries({ queryKey: [name] });
      onSaved(saved, product === null);
    },
    onError(error) { setServerErrors(serverFields(error, ["name", "description", "brand", "category", "specs", "price_syp", "price_usd", "sort_order"])); toast.error(errorText(error)); },
  });
  // Adjusting state while rendering: the pick is applied in the render that first sees the new option.
  if (pendingPick) {
    const list = pendingPick.kind === "brand" ? brands.data?.results : categories.data?.results;
    if (list?.some((item) => String(item.id) === pendingPick.id)) {
      setForm((current) => ({ ...current, [pendingPick.kind]: pendingPick.id }));
      setPendingPick(null);
    }
  }
  const submit = () => { setShow(true); if (Object.keys(problems).length === 0) save.mutate(); };

  const specsError = show && problems.specs ? t(`store.product.specsProblem.${problems.specs}` as "store.product.specsProblem.tooMany", { max: SPEC_MAX_ROWS }) : serverErrors.specs ?? null;
  const nameError = (show && problems.name ? (problems.name === "required" ? t("store.problem.required") : t("store.problem.tooLong", { max: PRODUCT_NAME_MAX })) : null) || serverErrors.name || null;

  return (
    <>
    <form className="space-y-5" noValidate onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <Field label={t("store.field.name")} htmlFor="product-name" error={nameError}>
        <Input id="product-name" dir="auto" className="h-11" value={form.name} onChange={(event) => set({ name: event.target.value })} aria-invalid={Boolean(nameError)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("store.product.category")} htmlFor="product-category" error={(show && problems.category ? t("store.problem.required") : null) || serverErrors.category || null}>
          <div className="flex gap-2">
          <Select value={form.category || undefined} onValueChange={(category) => set({ category })}>
            <SelectTrigger id="product-category" className="h-11" aria-invalid={show && Boolean(problems.category)}><SelectValue placeholder={categories.isPending ? t("app.loading") : t("store.product.pickCategory")} /></SelectTrigger>
            <SelectContent>{(categories.data?.results ?? []).map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label={t("store.category.add")} title={t("store.category.add")} onClick={() => setCreating("category")}><Plus /></Button>
          </div>
          {categories.data && categories.data.results.length === 0 ? <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{t("store.product.needCategory")}</p> : null}
        </Field>
        <Field label={t("store.product.brand")} htmlFor="product-brand" optional={t("counter.optional")} error={serverErrors.brand ?? null}>
          <div className="flex gap-2">
          <Select value={form.brand || NONE} onValueChange={(brand) => set({ brand: brand === NONE ? "" : brand })}>
            <SelectTrigger id="product-brand" className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={NONE}>{t("store.product.noBrand")}</SelectItem>{(brands.data?.results ?? []).map((brand) => <SelectItem key={brand.id} value={String(brand.id)}>{brand.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label={t("store.brand.add")} title={t("store.brand.add")} onClick={() => setCreating("brand")}><Plus /></Button>
          </div>
        </Field>
      </div>
      <Field label={t("store.product.description")} htmlFor="product-description" optional={t("counter.optional")} error={serverErrors.description ?? null}>
        <Textarea id="product-description" dir="auto" rows={4} value={form.description} onChange={(event) => set({ description: event.target.value })} />
      </Field>

      <fieldset className="space-y-3 rounded-2xl border p-4">
        <legend className="px-2 text-sm font-bold">{t("store.product.prices")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("store.product.priceSyp")} htmlFor="product-syp" error={(show && priceError(problems.priceSyp)) || serverErrors.price_syp || null}>
            <Input id="product-syp" dir="ltr" inputMode="decimal" className="h-11" value={form.priceSyp} onChange={(event) => set({ priceSyp: event.target.value.replace(/[^\d.]/gu, "") })} aria-invalid={show && Boolean(problems.priceSyp)} />
          </Field>
          <Field label={t("store.product.priceUsd")} htmlFor="product-usd" error={(show && priceError(problems.priceUsd)) || serverErrors.price_usd || null}>
            <Input id="product-usd" dir="ltr" inputMode="decimal" className="h-11" value={form.priceUsd} onChange={(event) => set({ priceUsd: event.target.value.replace(/[^\d.]/gu, "") })} aria-invalid={show && Boolean(problems.priceUsd)} />
          </Field>
        </div>
        <p className={`text-xs leading-5 ${hasNoPrice(form) ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>{hasNoPrice(form) ? t("store.product.noPriceWarning") : t("store.product.pricesHint")}</p>
      </fieldset>

      <fieldset className="space-y-3 rounded-2xl border p-4">
        <legend className="px-2 text-sm font-bold">{t("store.product.specs")}</legend>
        <p className="text-xs leading-5 text-muted-foreground">{t("store.product.specsHint", { max: SPEC_MAX_ROWS })}</p>
        <div className="space-y-2">
          {form.specs.map((row, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <Input dir="auto" aria-label={t("store.product.specLabel")} placeholder={t("store.product.specLabel")} maxLength={SPEC_LABEL_MAX + 20} value={row.label} onChange={(event) => set({ specs: form.specs.map((spec, i) => (i === index ? { ...spec, label: event.target.value } : spec)) })} />
              <Input dir="auto" aria-label={t("store.product.specValue")} placeholder={t("store.product.specValue")} maxLength={SPEC_VALUE_MAX + 20} value={row.value} onChange={(event) => set({ specs: form.specs.map((spec, i) => (i === index ? { ...spec, value: event.target.value } : spec)) })} />
              <Button type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive" aria-label={t("store.product.specRemove")} onClick={() => set({ specs: form.specs.filter((_, i) => i !== index) })}><Trash2 /></Button>
            </div>
          ))}
        </div>
        {specsError ? <p role="alert" className="text-xs font-medium text-destructive">{specsError}</p> : null}
        <Button type="button" variant="outline" size="sm" disabled={form.specs.length >= SPEC_MAX_ROWS} onClick={() => set({ specs: [...form.specs, { label: "", value: "" }] })}><Plus />{t("store.product.specAdd")}</Button>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("store.field.sort")} htmlFor="product-sort" hint={t("store.field.sortHint")} error={(show && problems.sortOrder ? t("store.problem.invalid") : null) || serverErrors.sort_order || null}>
          <Input id="product-sort" dir="ltr" inputMode="numeric" className="h-11" value={form.sortOrder} onChange={(event) => set({ sortOrder: event.target.value.replace(/\D/gu, "") })} />
        </Field>
        <div className="flex items-center justify-between gap-3 rounded-xl border p-3 sm:mt-7">
          <span><span className="block text-sm font-semibold">{t("store.field.active")}</span><span className="text-xs text-muted-foreground">{t("store.product.activeHint")}</span></span>
          <Switch checked={form.isActive} onCheckedChange={(isActive) => set({ isActive })} aria-label={t("store.field.active")} />
        </div>
      </div>
      <DialogFooter className="gap-2"><Button type="submit" disabled={save.isPending}>{product ? t("common.save") : t("store.product.createAndContinue")}</Button></DialogFooter>
    </form>
    {creating === "category" ? <CategoryDialog category={null} onClose={() => setCreating(null)} onSaved={(saved) => setPendingPick({ kind: "category", id: String(saved.id) })} /> : null}
    {creating === "brand" ? <BrandDialog brand={null} onClose={() => setCreating(null)} onSaved={(saved) => setPendingPick({ kind: "brand", id: String(saved.id) })} /> : null}
    </>
  );
}

/** Product editor: details, then variants (colour/size/price/stock), then pictures. A new product continues to its variants once saved. */
export function ProductEditor({ target, section, focusVariant, onClose }: { target: StoreProduct | number | "new"; section?: EditorSection; focusVariant?: number | null; onClose: () => void }) {
  const { t } = useI18n();
  const byId = typeof target === "number" ? target : null;
  const fetched = useQuery({
    queryKey: [KEYS.products, "one", byId],
    enabled: byId !== null,
    queryFn: async () => (await unwrap<StoreProduct>(apiFetch(storePath("products", byId as number)))) as StoreProduct,
  });
  const [created, setCreated] = useState<StoreProduct | null>(null);
  const [tab, setTab] = useState<EditorSection>(section ?? "details");
  const product = created ?? (typeof target === "object" ? target : fetched.data ?? null);
  const loading = byId !== null && fetched.isPending;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto">
        <DialogHeader className="pe-10">
          <DialogTitle dir="auto">{product ? product.name : t("store.product.add")}</DialogTitle>
          <DialogDescription>{product ? t("store.product.editIntro") : t("store.product.addIntro")}</DialogDescription>
        </DialogHeader>
        {loading ? <Skeleton className="h-72 rounded-2xl" /> : byId !== null && fetched.isError ? <ErrorPanel error={fetched.error} retry={() => void fetched.refetch()} /> : (
          <Tabs value={tab} onValueChange={(value) => setTab(value as EditorSection)}>
            <TabsList className="mb-4 h-auto w-full justify-start">
              <TabsTrigger value="details">{t("store.product.tabDetails")}</TabsTrigger>
              <TabsTrigger value="variants" disabled={!product}>{t("store.product.tabVariants")}</TabsTrigger>
              <TabsTrigger value="images" disabled={!product}>{t("store.product.tabImages")}</TabsTrigger>
            </TabsList>
            <TabsContent value="details"><DetailsForm key={product?.id ?? "new"} product={product} onSaved={(saved, wasCreated) => { setCreated(saved); if (wasCreated) setTab("variants"); }} /></TabsContent>
            <TabsContent value="variants">{product ? <VariantsSection product={product} focusVariant={focusVariant} /> : null}</TabsContent>
            <TabsContent value="images">{product ? <ImagesSection productId={product.id} productName={product.name} /> : null}</TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
