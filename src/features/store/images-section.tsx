"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, Star, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KEYS, useProductImages } from "@/features/store/catalog-api";
import { StoreImage, useStoreErrorText } from "@/features/store/store-ui";
import { IMAGE_MAX_BYTES, MAX_IMAGES_ACCEPT, imageProblem, imageUploadFields, nextImageSort, orderedImages, reorderImages, storePath } from "@/features/store/store-rules";
import { useI18n } from "@/i18n/provider";
import { apiFetch } from "@/lib/api/browser-client";
import { cn } from "@/lib/utils";

/** Product pictures: add several at once (5 MB, JPG/PNG/WebP), choose the primary one, reorder by dragging or with the arrows. */
export function ImagesSection({ productId, productName }: { productId: number; productName: string }) {
  const { t, direction } = useI18n();
  const queryClient = useQueryClient();
  const errorText = useStoreErrorText();
  const images = useProductImages(productId);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [rejected, setRejected] = useState<string[]>([]);

  const refresh = () => { void queryClient.invalidateQueries({ queryKey: [KEYS.images] }); };
  const list = orderedImages(images.data?.results ?? []);
  const Earlier = direction === "rtl" ? ArrowRight : ArrowLeft;
  const Later = direction === "rtl" ? ArrowLeft : ArrowRight;

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      let sort = nextImageSort(images.data?.results ?? []);
      let hasPrimary = (images.data?.results ?? []).some((image) => image.is_primary);
      setUploading({ done: 0, total: files.length });
      const failures: string[] = [];
      for (const [index, file] of files.entries()) {
        const data = new FormData();
        for (const [name, value] of imageUploadFields({ product: productId, altText: productName, sortOrder: sort, isPrimary: !hasPrimary })) data.append(name, value);
        data.append("image", file);
        try {
          await apiFetch(storePath("images"), { method: "POST", body: data });
          hasPrimary = true;
          sort += 1;
        } catch (error) {
          failures.push(`${file.name}: ${errorText(error)}`);
        }
        setUploading({ done: index + 1, total: files.length });
      }
      return failures;
    },
    onSuccess(failures) {
      setUploading(null);
      setRejected((current) => [...current, ...failures]);
      if (failures.length === 0) toast.success(t("store.images.uploaded"));
      refresh();
    },
    onError(error) { setUploading(null); toast.error(errorText(error)); },
  });

  function addFiles(fileList: FileList | File[] | null | undefined) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    const bad: string[] = [];
    const good: File[] = [];
    for (const file of files) {
      const problem = imageProblem(file);
      if (problem) bad.push(`${file.name}: ${t(problem === "type" ? "store.image.type" : "store.image.size", { max: IMAGE_MAX_BYTES / 1024 / 1024 })}`);
      else good.push(file);
    }
    setRejected(bad);
    if (good.length) upload.mutate(good);
  }

  const makePrimary = useMutation({
    mutationFn: async (id: number) => { await apiFetch(storePath("images", id), { method: "PATCH", body: { is_primary: true } }); },
    onSuccess() { toast.success(t("store.images.primarySet")); refresh(); },
    onError(error) { toast.error(errorText(error)); },
  });

  const reorder = useMutation({
    mutationFn: async (pairs: [number, number][]) => { for (const [id, sort] of pairs) await apiFetch(storePath("images", id), { method: "PATCH", body: { sort_order: sort } }); },
    onSettled: refresh,
    onError(error) { toast.error(errorText(error)); },
  });

  const remove = useMutation({
    mutationFn: async (image: { id: number; is_primary: boolean }) => {
      await apiFetch(storePath("images", image.id), { method: "DELETE" });
      // A product without a primary picture shows nothing in the store: the next one takes over.
      const next = list.find((candidate) => candidate.id !== image.id);
      if (image.is_primary && next) await apiFetch(storePath("images", next.id), { method: "PATCH", body: { is_primary: true } });
    },
    onSuccess() { toast.success(t("store.deleted")); refresh(); },
    onError(error) { toast.error(errorText(error)); refresh(); },
  });

  const move = (id: number, offset: -1 | 1) => {
    const ids = list.map((image) => image.id);
    const target = ids[ids.indexOf(id) + offset];
    if (target !== undefined) reorder.mutate(reorderImages(ids, id, target));
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(event) => { if (dragging === null) { event.preventDefault(); setDropActive(true); } }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(event) => { if (dragging === null) { event.preventDefault(); setDropActive(false); addFiles(event.dataTransfer.files); } }}
        className={cn("flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-colors", dropActive ? "border-primary bg-primary/5" : "bg-muted/20")}
      >
        <UploadCloud className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t("store.images.drop")}</p>
        <input ref={input} id="store-images-input" type="file" multiple accept={MAX_IMAGES_ACCEPT} className="sr-only" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
        <Button type="button" variant="outline" disabled={upload.isPending} onClick={() => input.current?.click()}><ImagePlus />{t("store.images.add")}</Button>
        <p className="text-xs text-muted-foreground">{t("store.image.hint", { max: IMAGE_MAX_BYTES / 1024 / 1024 })}</p>
        {uploading ? <p role="status" className="text-sm font-semibold">{t("store.images.uploading", { done: uploading.done, total: uploading.total })}</p> : null}
      </div>
      {rejected.length ? (
        <ul role="alert" className="space-y-1 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs font-medium text-destructive">{rejected.map((line) => <li key={line}><bdi>{line}</bdi></li>)}</ul>
      ) : null}

      {images.isPending ? <Skeleton className="h-40 rounded-2xl" /> : images.isError ? <ErrorPanel error={images.error} retry={() => void images.refetch()} /> : list.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">{t("store.images.empty")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((image, index) => (
            <li
              key={image.id}
              draggable={!image.is_primary}
              onDragStart={() => setDragging(image.id)}
              onDragEnd={() => { setDragging(null); setOver(null); }}
              onDragOver={(event) => { if (dragging !== null && dragging !== image.id && !image.is_primary) { event.preventDefault(); setOver(image.id); } }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragging !== null) reorder.mutate(reorderImages(list.map((item) => item.id), dragging, image.id));
                setDragging(null); setOver(null);
              }}
              className={cn("group relative overflow-hidden rounded-2xl border bg-card", image.is_primary && "ring-2 ring-primary", over === image.id && "outline outline-2 outline-primary", dragging === image.id && "opacity-50")}
            >
              <StoreImage url={image.thumb_url} alt={image.alt_text || productName} className="aspect-square w-full border-0" rounded="rounded-none" />
              {image.is_primary ? <Badge className="absolute start-2 top-2 gap-1"><Star className="size-3" aria-hidden="true" />{t("store.images.primary")}</Badge> : <GripVertical className="absolute end-2 top-2 size-5 rounded bg-background/80 p-0.5 text-muted-foreground" aria-hidden="true" />}
              <div className="flex items-center justify-between gap-1 border-t p-1.5">
                <div className="flex">
                  <Button type="button" size="icon" variant="ghost" className="size-8" disabled={index === 0 || list[index - 1]?.is_primary === true || image.is_primary || reorder.isPending} aria-label={t("store.images.earlier")} onClick={() => move(image.id, -1)}><Earlier className="size-4" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="size-8" disabled={index === list.length - 1 || image.is_primary || reorder.isPending} aria-label={t("store.images.later")} onClick={() => move(image.id, 1)}><Later className="size-4" /></Button>
                </div>
                <div className="flex">
                  {!image.is_primary ? <Button type="button" size="icon" variant="ghost" className="size-8" disabled={makePrimary.isPending} aria-label={t("store.images.makePrimary")} title={t("store.images.makePrimary")} onClick={() => makePrimary.mutate(image.id)}><Star className="size-4" /></Button> : null}
                  <ConfirmDialog trigger={<Button type="button" size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" aria-label={t("common.delete")}><Trash2 className="size-4" /></Button>} title={t("store.images.deleteTitle")} description={t("store.images.deleteHint")} confirmLabel={t("common.delete")} cancelLabel={t("common.cancel")} onConfirm={() => remove.mutate(image)} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
