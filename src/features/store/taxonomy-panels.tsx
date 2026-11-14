"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Pencil, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { KEYS, useAllBrands, useAllCategories, type StoreBrand, type StoreCategory } from "@/features/store/catalog-api";
import { ActiveBadge, Field, StoreImage, useServerFieldErrors, useStoreErrorText } from "@/features/store/store-ui";
import {
  BRAND_NAME_MAX, CATEGORY_NAME_MAX, CATEGORY_SLUG_MAX, EMPTY_BRAND, EMPTY_CATEGORY, IMAGE_MAX_BYTES, MAX_IMAGES_ACCEPT, brandFields, brandMultipart,
  categoryFields, imageProblem, storePath, suggestSlug, validateBrand, validateCategory, type BrandForm, type CategoryForm, type LogoChange,
} from "@/features/store/store-rules";
import { useI18n } from "@/i18n/provider";
import { apiFetch } from "@/lib/api/browser-client";

type Translate = ReturnType<typeof useI18n>["t"];

function problemText(problem: string | undefined, t: Translate, max?: number): string | null {
  if (!problem) return null;
  if (problem === "required") return t("store.problem.required");
  if (problem === "tooLong") return t("store.problem.tooLong", { max: max ?? 0 });
  return t("store.problem.invalid");
}

/** Switch that saves the active flag at once, with the whole row disabled while the request runs. */
function ActiveSwitch({ id, active, label, path, invalidate }: { id: number; active: boolean; label: string; path: string; invalidate: readonly string[] }) {
  const queryClient = useQueryClient();
  const errorText = useStoreErrorText();
  const save = useMutation({
    mutationFn: async (next: boolean) => { await apiFetch(path, { method: "PATCH", body: { is_active: next } }); },
    onSuccess() { for (const key of invalidate) void queryClient.invalidateQueries({ queryKey: [key] }); },
    onError(error) { toast.error(errorText(error)); },
  });
  return <Switch checked={active} disabled={save.isPending} aria-label={`${label} (${id})`} onCheckedChange={(next) => save.mutate(next)} />;
}

function useDelete(resource: "brands" | "categories", key: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const errorText = useStoreErrorText();
  return useMutation({
    mutationFn: async (id: number) => { await apiFetch(storePath(resource, id), { method: "DELETE" }); },
    onSuccess() { toast.success(t("store.deleted")); void queryClient.invalidateQueries({ queryKey: [key] }); },
    // IN_USE (409) explains that products must move first; every other failure uses the generic sentence.
    onError(error) { toast.error(errorText(error)); },
  });
}

// ---- brands -------------------------------------------------------------------------------------------------------------

function LogoPicker({ existingUrl, change, onChange }: { existingUrl: string | null; change: LogoChange; onChange: (value: LogoChange) => void }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const picked = useMemo(() => (change.kind === "replace" ? URL.createObjectURL(change.file) : null), [change]);
  useEffect(() => () => { if (picked) URL.revokeObjectURL(picked); }, [picked]);
  const shown = change.kind === "replace" ? picked : change.kind === "keep" ? existingUrl : null;
  const hasLogo = shown !== null;
  const pick = (file: File | undefined) => {
    if (!file) return;
    const problem = imageProblem(file);
    if (problem) { setError(t(problem === "type" ? "store.image.type" : "store.image.size", { max: IMAGE_MAX_BYTES / 1024 / 1024 })); return; }
    setError(null);
    onChange({ kind: "replace", file });
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        {change.kind === "replace" && picked ? (
          // eslint-disable-next-line @next/next/no-img-element -- a temporary local preview of the picked file
          <img src={picked} alt="" className="size-20 rounded-xl border object-cover" />
        ) : change.kind === "keep" ? <StoreImage url={existingUrl} className="size-20" rounded="rounded-xl" /> : <StoreImage url={null} className="size-20" rounded="rounded-xl" />}
        <div className="flex flex-wrap gap-2">
          <input ref={input} id="brand-logo" type="file" accept={MAX_IMAGES_ACCEPT} className="sr-only" onChange={(event) => { pick(event.target.files?.[0]); event.target.value = ""; }} />
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}><ImagePlus />{hasLogo ? t("store.brand.logoReplace") : t("store.brand.logoPick")}</Button>
          {hasLogo ? <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onChange({ kind: "remove" })}><X />{t("store.brand.logoRemove")}</Button> : null}
          {change.kind !== "keep" ? <Button type="button" variant="ghost" size="sm" onClick={() => { setError(null); onChange({ kind: "keep" }); }}><RotateCcw />{t("store.brand.logoUndo")}</Button> : null}
        </div>
      </div>
      {error ? <p role="alert" className="text-xs font-medium text-destructive">{error}</p> : <p className="text-xs leading-5 text-muted-foreground">{t("store.image.hint", { max: IMAGE_MAX_BYTES / 1024 / 1024 })}</p>}
    </div>
  );
}

function BrandDialog({ brand, onClose }: { brand: StoreBrand | null; onClose: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const errorText = useStoreErrorText();
  const serverFields = useServerFieldErrors();
  const [form, setForm] = useState<BrandForm>(brand ? { name: brand.name, sortOrder: String(brand.sort_order), isActive: brand.is_active } : EMPTY_BRAND);
  const [logo, setLogo] = useState<LogoChange>({ kind: "keep" });
  const [show, setShow] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const problems = validateBrand(form);
  const set = (patch: Partial<BrandForm>) => setForm((current) => ({ ...current, ...patch }));

  const save = useMutation({
    mutationFn: async () => {
      const entries = brandMultipart(form, logo);
      let body: unknown = brandFields(form);
      if (entries) {
        const data = new FormData();
        for (const [name, value] of entries) data.append(name, value);
        body = data;
      }
      await apiFetch(brand ? storePath("brands", brand.id) : storePath("brands"), { method: brand ? "PATCH" : "POST", body });
    },
    onSuccess() { toast.success(t("store.saved")); void queryClient.invalidateQueries({ queryKey: [KEYS.brands] }); onClose(); },
    onError(error) { setServerErrors(serverFields(error, ["name", "logo", "sort_order"])); toast.error(errorText(error)); },
  });
  const submit = () => { setShow(true); if (Object.keys(problems).length === 0) save.mutate(); };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pe-10"><DialogTitle>{brand ? t("store.brand.edit") : t("store.brand.add")}</DialogTitle><DialogDescription>{t("store.brand.intro")}</DialogDescription></DialogHeader>
        <form className="space-y-4" noValidate onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <Field label={t("store.field.name")} htmlFor="brand-name" error={(show && problemText(problems.name, t, BRAND_NAME_MAX)) || serverErrors.name || null}>
            <Input id="brand-name" value={form.name} dir="auto" className="h-11" onChange={(event) => set({ name: event.target.value })} aria-invalid={show && Boolean(problems.name)} />
          </Field>
          <Field label={t("store.brand.logo")} htmlFor="brand-logo" optional={t("counter.optional")}><LogoPicker existingUrl={brand?.logo_url ?? null} change={logo} onChange={setLogo} />{serverErrors.logo ? <p role="alert" className="text-xs font-medium text-destructive">{serverErrors.logo}</p> : null}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("store.field.sort")} htmlFor="brand-sort" hint={t("store.field.sortHint")} error={(show && problemText(problems.sortOrder, t)) || serverErrors.sort_order || null}>
              <Input id="brand-sort" dir="ltr" inputMode="numeric" className="h-11" value={form.sortOrder} onChange={(event) => set({ sortOrder: event.target.value })} />
            </Field>
            <div className="flex items-center justify-between gap-3 rounded-xl border p-3 sm:mt-7"><span className="text-sm font-semibold">{t("store.field.active")}</span><Switch checked={form.isActive} onCheckedChange={(isActive) => set({ isActive })} aria-label={t("store.field.active")} /></div>
          </div>
          <DialogFooter className="gap-2"><Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button><Button type="submit" disabled={save.isPending}>{t("common.save")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BrandsPanel() {
  const { t } = useI18n();
  const brands = useAllBrands();
  const remove = useDelete("brands", KEYS.brands);
  const [editing, setEditing] = useState<StoreBrand | "new" | null>(null);
  const [search, setSearch] = useState("");
  const rows = (brands.data?.results ?? []).filter((brand) => brand.name.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input className="ps-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("store.brand.search")} aria-label={t("common.search")} dir="auto" /></div>
        <Button onClick={() => setEditing("new")}><Plus />{t("store.brand.add")}</Button>
      </div>
      {brands.isPending ? <Skeleton className="h-64 rounded-2xl" /> : brands.isError ? <ErrorPanel error={brands.error} retry={() => void brands.refetch()} /> : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>
                <th scope="col" className="w-16 p-3" /><th scope="col" className="p-3 text-start font-semibold">{t("store.field.name")}</th>
                <th scope="col" className="p-3 text-start font-semibold">{t("store.brand.products")}</th><th scope="col" className="p-3 text-start font-semibold">{t("store.field.active")}</th><th scope="col" className="w-32 p-3"><span className="sr-only">{t("common.actions")}</span></th>
              </tr></thead>
              <tbody>
                {rows.map((brand) => (
                  <tr key={brand.id} className="border-t align-middle hover:bg-muted/30">
                    <td className="p-3"><StoreImage url={brand.logo_url} className="size-10" /></td>
                    <td className="p-3 font-semibold" dir="auto">{brand.name}</td>
                    <td className="p-3 tabular-nums"><bdi>{brand.products_count}</bdi></td>
                    <td className="p-3"><div className="flex items-center gap-2"><ActiveSwitch id={brand.id} active={brand.is_active} label={brand.name} path={storePath("brands", brand.id)} invalidate={[KEYS.brands]} /><ActiveBadge active={brand.is_active} /></div></td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" aria-label={`${t("common.edit")} ${brand.name}`} onClick={() => setEditing(brand)}><Pencil /></Button>
                        <ConfirmDialog trigger={<Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`${t("common.delete")} ${brand.name}`}><Trash2 /></Button>} title={t("store.brand.deleteTitle", { name: brand.name })} description={t("store.deleteHint")} confirmLabel={t("common.delete")} cancelLabel={t("common.cancel")} onConfirm={() => remove.mutate(brand.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length ? <div className="p-10 text-center text-muted-foreground">{search ? t("store.noMatches") : t("store.brand.empty")}</div> : null}
        </div>
      )}
      {editing ? <BrandDialog key={editing === "new" ? "new" : editing.id} brand={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

// ---- categories ---------------------------------------------------------------------------------------------------------

function CategoryDialog({ category, onClose }: { category: StoreCategory | null; onClose: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const errorText = useStoreErrorText();
  const serverFields = useServerFieldErrors();
  const [form, setForm] = useState<CategoryForm>(category ? { name: category.name, slug: category.slug, sortOrder: String(category.sort_order), isActive: category.is_active } : EMPTY_CATEGORY);
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const [show, setShow] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const problems = validateCategory(form);
  const set = (patch: Partial<CategoryForm>) => setForm((current) => ({ ...current, ...patch }));

  const save = useMutation({
    mutationFn: async () => { await apiFetch(category ? storePath("categories", category.id) : storePath("categories"), { method: category ? "PATCH" : "POST", body: categoryFields(form) }); },
    onSuccess() { toast.success(t("store.saved")); void queryClient.invalidateQueries({ queryKey: [KEYS.categories] }); onClose(); },
    onError(error) { setServerErrors(serverFields(error, ["name", "slug", "sort_order"])); toast.error(errorText(error)); },
  });
  const submit = () => { setShow(true); if (Object.keys(problems).length === 0) save.mutate(); };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pe-10"><DialogTitle>{category ? t("store.category.edit") : t("store.category.add")}</DialogTitle><DialogDescription>{t("store.category.intro")}</DialogDescription></DialogHeader>
        <form className="space-y-4" noValidate onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <Field label={t("store.field.name")} htmlFor="cat-name" error={(show && problemText(problems.name, t, CATEGORY_NAME_MAX)) || serverErrors.name || null}>
            <Input id="cat-name" value={form.name} dir="auto" className="h-11" onChange={(event) => set({ name: event.target.value, ...(slugTouched ? {} : { slug: suggestSlug(event.target.value) }) })} aria-invalid={show && Boolean(problems.name)} />
          </Field>
          <Field label={t("store.category.slug")} htmlFor="cat-slug" hint={t("store.category.slugHint")} error={(show && problemText(problems.slug, t, CATEGORY_SLUG_MAX)) || serverErrors.slug || null}>
            <Input id="cat-slug" value={form.slug} dir="ltr" className="h-11" onChange={(event) => { setSlugTouched(true); set({ slug: event.target.value }); }} aria-invalid={show && Boolean(problems.slug)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("store.field.sort")} htmlFor="cat-sort" hint={t("store.field.sortHint")} error={(show && problemText(problems.sortOrder, t)) || serverErrors.sort_order || null}>
              <Input id="cat-sort" dir="ltr" inputMode="numeric" className="h-11" value={form.sortOrder} onChange={(event) => set({ sortOrder: event.target.value })} />
            </Field>
            <div className="flex items-center justify-between gap-3 rounded-xl border p-3 sm:mt-7"><span className="text-sm font-semibold">{t("store.field.active")}</span><Switch checked={form.isActive} onCheckedChange={(isActive) => set({ isActive })} aria-label={t("store.field.active")} /></div>
          </div>
          <DialogFooter className="gap-2"><Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button><Button type="submit" disabled={save.isPending}>{t("common.save")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CategoriesPanel() {
  const { t } = useI18n();
  const categories = useAllCategories();
  const remove = useDelete("categories", KEYS.categories);
  const [editing, setEditing] = useState<StoreCategory | "new" | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setEditing("new")}><Plus />{t("store.category.add")}</Button></div>
      {categories.isPending ? <Skeleton className="h-64 rounded-2xl" /> : categories.isError ? <ErrorPanel error={categories.error} retry={() => void categories.refetch()} /> : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>
                <th scope="col" className="p-3 text-start font-semibold">{t("store.field.name")}</th><th scope="col" className="p-3 text-start font-semibold">{t("store.category.slug")}</th>
                <th scope="col" className="p-3 text-start font-semibold">{t("store.field.sort")}</th>
                <th scope="col" className="p-3 text-start font-semibold">{t("store.field.active")}</th><th scope="col" className="w-32 p-3"><span className="sr-only">{t("common.actions")}</span></th>
              </tr></thead>
              <tbody>
                {categories.data.results.map((category) => (
                  <tr key={category.id} className="border-t align-middle hover:bg-muted/30">
                    <td className="p-3 font-semibold" dir="auto">{category.name}</td>
                    <td className="p-3 text-muted-foreground"><bdi dir="ltr">{category.slug}</bdi></td>
                    <td className="p-3 tabular-nums"><bdi>{category.sort_order}</bdi></td>
                    <td className="p-3"><div className="flex items-center gap-2"><ActiveSwitch id={category.id} active={category.is_active} label={category.name} path={storePath("categories", category.id)} invalidate={[KEYS.categories]} /><ActiveBadge active={category.is_active} /></div></td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" aria-label={`${t("common.edit")} ${category.name}`} onClick={() => setEditing(category)}><Pencil /></Button>
                        <ConfirmDialog trigger={<Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`${t("common.delete")} ${category.name}`}><Trash2 /></Button>} title={t("store.category.deleteTitle", { name: category.name })} description={t("store.deleteHint")} confirmLabel={t("common.delete")} cancelLabel={t("common.cancel")} onConfirm={() => remove.mutate(category.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!categories.data.results.length ? <div className="p-10 text-center text-muted-foreground">{t("store.category.empty")}</div> : null}
        </div>
      )}
      {editing ? <CategoryDialog key={editing === "new" ? "new" : editing.id} category={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
