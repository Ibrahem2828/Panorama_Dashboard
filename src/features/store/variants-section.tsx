"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Boxes, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { KEYS, useProductVariants, type StoreProduct, type StoreVariant } from "@/features/store/catalog-api";
import { StockDialog } from "@/features/store/stock-dialog";
import { ActiveBadge, Field, StockBadge, useServerFieldErrors, useStoreErrorText } from "@/features/store/store-ui";
import {
  EMPTY_VARIANT, SKU_MAX, VARIANT_LABEL_MAX, effectivePrice, isHexColour, stockLevel, storePath, validateVariant, variantBody, variantLabel, type VariantForm,
} from "@/features/store/store-rules";
import { useI18n } from "@/i18n/provider";
import { apiFetch } from "@/lib/api/browser-client";

type Translate = ReturnType<typeof useI18n>["t"];

function priceText(problem: string | undefined, t: Translate): string | null {
  if (!problem) return null;
  return t(`store.problem.price.${problem}` as "store.problem.price.invalid");
}

function fromVariant(variant: StoreVariant): VariantForm {
  return {
    sku: variant.sku, colourName: variant.colour_name, colourHex: variant.colour_hex, sizeLabel: variant.size_label,
    priceSyp: variant.price_syp ?? "", priceUsd: variant.price_usd ?? "", maxPerOrder: variant.max_per_order === null ? "" : String(variant.max_per_order),
    isActive: variant.is_active, sortOrder: String(variant.sort_order), initialStock: "0", reorderLevel: String(variant.reorder_level),
  };
}

export function ColourSwatch({ hex, className = "size-5" }: { hex: string; className?: string }) {
  return isHexColour(hex)
    ? <span className={`inline-block shrink-0 rounded-full border shadow-inner ${className}`} style={{ backgroundColor: hex }} aria-hidden="true" />
    : <span className={`inline-block shrink-0 rounded-full border border-dashed ${className}`} aria-hidden="true" />;
}

function VariantDialog({ product, variant, onClose }: { product: StoreProduct; variant: StoreVariant | null; onClose: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const errorText = useStoreErrorText();
  const serverFields = useServerFieldErrors();
  const creating = variant === null;
  const [form, setForm] = useState<VariantForm>(variant ? fromVariant(variant) : EMPTY_VARIANT);
  const [show, setShow] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const problems = validateVariant(form, creating);
  const set = (patch: Partial<VariantForm>) => setForm((current) => ({ ...current, ...patch }));
  const tooLong = (max: number) => t("store.problem.tooLong", { max });
  const invalid = t("store.problem.invalid");

  const save = useMutation({
    mutationFn: async () => { await apiFetch(variant ? storePath("variants", variant.id) : storePath("variants"), { method: variant ? "PATCH" : "POST", body: variantBody(form, product.id, creating) }); },
    onSuccess() {
      toast.success(t("store.saved"));
      for (const name of [KEYS.variants, KEYS.products, "store-summary"]) void queryClient.invalidateQueries({ queryKey: [name] });
      onClose();
    },
    onError(error) { setServerErrors(serverFields(error, ["sku", "colour_name", "colour_hex", "size_label", "price_syp", "price_usd", "max_per_order", "non_field_errors", "initial_stock", "reorder_level"])); toast.error(errorText(error)); },
  });
  const submit = () => { setShow(true); if (Object.keys(problems).length === 0) save.mutate(); };
  const hex = isHexColour(form.colourHex.trim()) ? form.colourHex.trim() : "#000000";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader className="pe-10"><DialogTitle>{creating ? t("store.variant.add") : t("store.variant.edit")}</DialogTitle><DialogDescription><span dir="auto">{product.name}</span> — {t("store.variant.intro")}</DialogDescription></DialogHeader>
        <form className="space-y-4" noValidate onSubmit={(event) => { event.preventDefault(); submit(); }}>
          {serverErrors.non_field_errors ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm font-medium text-destructive">{serverErrors.non_field_errors}</p> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("store.variant.colourName")} htmlFor="variant-colour" optional={t("counter.optional")} error={(show && problems.colourName && tooLong(VARIANT_LABEL_MAX)) || serverErrors.colour_name || null}>
              <Input id="variant-colour" dir="auto" className="h-11" value={form.colourName} onChange={(event) => set({ colourName: event.target.value })} />
            </Field>
            <Field label={t("store.variant.colourHex")} htmlFor="variant-hex" optional={t("counter.optional")} hint={t("store.variant.colourHexHint")} error={(show && problems.colourHex && invalid) || serverErrors.colour_hex || null}>
              <div className="flex items-center gap-2">
                <input type="color" aria-label={t("store.variant.colourPicker")} value={hex} onChange={(event) => set({ colourHex: event.target.value.toUpperCase() })} className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border bg-background p-1" />
                <Input id="variant-hex" dir="ltr" className="h-11 font-mono uppercase" placeholder="#1A2B3C" maxLength={7} value={form.colourHex} onChange={(event) => set({ colourHex: event.target.value })} aria-invalid={show && Boolean(problems.colourHex)} />
                {form.colourHex ? <Button type="button" variant="ghost" size="sm" onClick={() => set({ colourHex: "" })}>{t("store.variant.colourClear")}</Button> : null}
              </div>
            </Field>
            <Field label={t("store.variant.size")} htmlFor="variant-size" optional={t("counter.optional")} error={(show && problems.sizeLabel && tooLong(VARIANT_LABEL_MAX)) || serverErrors.size_label || null}>
              <Input id="variant-size" dir="auto" className="h-11" value={form.sizeLabel} onChange={(event) => set({ sizeLabel: event.target.value })} />
            </Field>
            <Field label={t("store.variant.sku")} htmlFor="variant-sku" optional={t("counter.optional")} error={(show && problems.sku && tooLong(SKU_MAX)) || serverErrors.sku || null}>
              <Input id="variant-sku" dir="ltr" className="h-11" value={form.sku} onChange={(event) => set({ sku: event.target.value })} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("store.variant.priceSyp")} htmlFor="variant-syp" hint={product.price_syp ? t("store.variant.priceInherit", { price: product.price_syp }) : t("store.variant.priceNone")} error={(show && priceText(problems.priceSyp, t)) || serverErrors.price_syp || null}>
              <Input id="variant-syp" dir="ltr" inputMode="decimal" className="h-11" value={form.priceSyp} onChange={(event) => set({ priceSyp: event.target.value.replace(/[^\d.]/gu, "") })} />
            </Field>
            <Field label={t("store.variant.priceUsd")} htmlFor="variant-usd" hint={product.price_usd ? t("store.variant.priceInherit", { price: product.price_usd }) : t("store.variant.priceNone")} error={(show && priceText(problems.priceUsd, t)) || serverErrors.price_usd || null}>
              <Input id="variant-usd" dir="ltr" inputMode="decimal" className="h-11" value={form.priceUsd} onChange={(event) => set({ priceUsd: event.target.value.replace(/[^\d.]/gu, "") })} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {creating ? (
              <Field label={t("store.variant.initialStock")} htmlFor="variant-initial" error={(show && problems.initialStock && invalid) || serverErrors.initial_stock || null}>
                <Input id="variant-initial" dir="ltr" inputMode="numeric" className="h-11" value={form.initialStock} onChange={(event) => set({ initialStock: event.target.value.replace(/\D/gu, "") })} />
              </Field>
            ) : null}
            <Field label={t("store.variant.reorderLevel")} htmlFor="variant-reorder" hint={t("store.variant.reorderHint")} error={(show && problems.reorderLevel && invalid) || serverErrors.reorder_level || null}>
              <Input id="variant-reorder" dir="ltr" inputMode="numeric" className="h-11" value={form.reorderLevel} onChange={(event) => set({ reorderLevel: event.target.value.replace(/\D/gu, "") })} />
            </Field>
            <Field label={t("store.variant.maxPerOrder")} htmlFor="variant-max" optional={t("counter.optional")} error={(show && problems.maxPerOrder && invalid) || serverErrors.max_per_order || null}>
              <Input id="variant-max" dir="ltr" inputMode="numeric" className="h-11" value={form.maxPerOrder} onChange={(event) => set({ maxPerOrder: event.target.value.replace(/\D/gu, "") })} />
            </Field>
            <Field label={t("store.field.sort")} htmlFor="variant-sort" error={(show && problems.sortOrder && invalid) || null}>
              <Input id="variant-sort" dir="ltr" inputMode="numeric" className="h-11" value={form.sortOrder} onChange={(event) => set({ sortOrder: event.target.value.replace(/\D/gu, "") })} />
            </Field>
          </div>
          {!creating ? <p className="text-xs leading-5 text-muted-foreground">{t("store.variant.stockViaDialog")}</p> : null}
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3"><span className="text-sm font-semibold">{t("store.field.active")}</span><Switch checked={form.isActive} onCheckedChange={(isActive) => set({ isActive })} aria-label={t("store.field.active")} /></div>
          <DialogFooter className="gap-2"><Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button><Button type="submit" disabled={save.isPending}>{t("common.save")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function VariantsSection({ product, focusVariant }: { product: StoreProduct; focusVariant?: number | null }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const errorText = useStoreErrorText();
  const variants = useProductVariants(product.id);
  const [editing, setEditing] = useState<StoreVariant | "new" | null>(null);
  const [stockFor, setStockFor] = useState<StoreVariant | null>(null);

  const remove = useMutation({
    mutationFn: async (id: number) => { await apiFetch(storePath("variants", id), { method: "DELETE" }); },
    onSuccess() { toast.success(t("store.deleted")); for (const name of [KEYS.variants, KEYS.products, "store-summary"]) void queryClient.invalidateQueries({ queryKey: [name] }); },
    onError(error) { toast.error(errorText(error)); },
  });
  const toggle = useMutation({
    mutationFn: async (input: { id: number; active: boolean }) => { await apiFetch(storePath("variants", input.id), { method: "PATCH", body: { is_active: input.active } }); },
    onSuccess() { void queryClient.invalidateQueries({ queryKey: [KEYS.variants] }); void queryClient.invalidateQueries({ queryKey: ["store-summary"] }); },
    onError(error) { toast.error(errorText(error)); },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">{t("store.variant.sectionHint")}</p>
        <Button onClick={() => setEditing("new")}><Plus />{t("store.variant.add")}</Button>
      </div>
      {variants.isPending ? <Skeleton className="h-40 rounded-2xl" /> : variants.isError ? <ErrorPanel error={variants.error} retry={() => void variants.refetch()} /> : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>
                <th scope="col" className="p-3 text-start font-semibold">{t("store.variant.title")}</th><th scope="col" className="p-3 text-start font-semibold">{t("store.variant.sku")}</th>
                <th scope="col" className="p-3 text-start font-semibold">{t("store.product.prices")}</th><th scope="col" className="p-3 text-start font-semibold">{t("store.stock.shelf")}</th>
                <th scope="col" className="p-3 text-start font-semibold">{t("store.field.active")}</th><th scope="col" className="w-40 p-3"><span className="sr-only">{t("common.actions")}</span></th>
              </tr></thead>
              <tbody>
                {variants.data.results.map((variant) => {
                  const label = variantLabel(variant);
                  return (
                    <tr key={variant.id} className={`border-t align-middle hover:bg-muted/30 ${focusVariant === variant.id ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""}`}>
                      <td className="min-w-[10rem] p-3"><span className="flex items-center gap-2 font-semibold" dir="auto"><ColourSwatch hex={variant.colour_hex} />{label || t("store.variant.plain")}</span></td>
                      <td className="p-3 text-muted-foreground"><bdi dir="ltr">{variant.sku || "—"}</bdi></td>
                      <td className="p-3 text-xs">
                        <span className="block"><Money value={effectivePrice(variant.price_syp, product.price_syp)} currency="SYP" />{variant.price_syp ? <span className="ms-1 text-primary">•</span> : null}</span>
                        <span className="block"><Money value={effectivePrice(variant.price_usd, product.price_usd)} currency="USD" />{variant.price_usd ? <span className="ms-1 text-primary">•</span> : null}</span>
                      </td>
                      <td className="p-3"><StockBadge stock={variant.stock} level={stockLevel(variant.stock, variant.reorder_level)} /></td>
                      <td className="p-3"><div className="flex items-center gap-2"><Switch checked={variant.is_active} disabled={toggle.isPending} aria-label={`${t("store.field.active")}: ${label}`} onCheckedChange={(active) => toggle.mutate({ id: variant.id, active })} /><span className="hidden lg:inline"><ActiveBadge active={variant.is_active} /></span></div></td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" aria-label={`${t("store.stock.title")}: ${label}`} title={t("store.stock.title")} onClick={() => setStockFor(variant)}><Boxes /></Button>
                          <Button size="icon" variant="ghost" aria-label={`${t("common.edit")}: ${label}`} onClick={() => setEditing(variant)}><Pencil /></Button>
                          <ConfirmDialog trigger={<Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`${t("common.delete")}: ${label}`}><Trash2 /></Button>} title={t("store.variant.deleteTitle")} description={t("store.variant.deleteHint")} confirmLabel={t("common.delete")} cancelLabel={t("common.cancel")} onConfirm={() => remove.mutate(variant.id)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!variants.data.results.length ? <div className="p-8 text-center text-sm text-muted-foreground">{t("store.variant.empty")}</div> : null}
          <p className="border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground"><span className="text-primary">•</span> {t("store.variant.overrideLegend")}</p>
        </div>
      )}
      {editing ? <VariantDialog key={editing === "new" ? "new" : editing.id} product={product} variant={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      {stockFor ? <StockDialog variant={{ id: stockFor.id, label: variantLabel(stockFor), productName: product.name, stock: stockFor.stock }} onClose={() => setStockFor(null)} /> : null}
    </div>
  );
}
