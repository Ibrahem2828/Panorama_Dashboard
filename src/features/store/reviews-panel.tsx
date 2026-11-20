"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, RefreshCw, Star } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Pagination } from "@/components/data-grid/pagination";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { KEYS } from "@/features/store/catalog-api";
import { Field, useStoreErrorText } from "@/features/store/store-ui";
import { REASON_MAX, reasonProblem, resolveHiddenFilter, reviewQuery, storePath, type HiddenFilter } from "@/features/store/store-rules";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";
import { formatDate } from "@/lib/utils";

interface StoreReview {
  id: number;
  product: number;
  product_name: string;
  author: { id: number; full_name: string };
  rating: number;
  text: string;
  edit_count: number;
  is_hidden: boolean;
  hidden_reason: string;
  moderated_at: string | null;
  created_at: string;
}

const REVIEWS_KEY = "store-reviews";
const ALL = "all";

function Stars({ value }: { value: number }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={t("store.reviews.stars", { count: value })}>
      {[1, 2, 3, 4, 5].map((index) => <Star key={index} className={`size-4 ${index <= value ? "fill-amber-400 text-amber-500" : "text-muted-foreground/40"}`} aria-hidden="true" />)}
    </span>
  );
}

function HideDialog({ review, onClose }: { review: StoreReview; onClose: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const errorText = useStoreErrorText();
  const [reason, setReason] = useState("");
  const [show, setShow] = useState(false);
  const problem = reasonProblem(reason);
  const hide = useMutation({
    mutationFn: async () => { await apiFetch(storePath("reviews", review.id, "hide"), { method: "POST", body: { reason: reason.trim() } }); },
    onSuccess() {
      toast.success(t("store.reviews.hidden"));
      for (const name of [REVIEWS_KEY, "store-summary", KEYS.products]) void queryClient.invalidateQueries({ queryKey: [name] });
      onClose();
    },
    onError(error) { toast.error(errorText(error)); },
  });
  const submit = () => { setShow(true); if (!problem) hide.mutate(); };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pe-10"><DialogTitle>{t("store.reviews.hideTitle")}</DialogTitle><DialogDescription>{t("store.reviews.hideHint")}</DialogDescription></DialogHeader>
        <blockquote className="rounded-xl border bg-muted/30 p-3 text-sm"><Stars value={review.rating} /><p className="mt-1 whitespace-pre-wrap break-words" dir="auto">{review.text || t("store.reviews.noText")}</p></blockquote>
        <Field label={t("store.reviews.reason")} htmlFor="review-reason" error={show && problem ? (problem === "required" ? t("store.problem.reasonRequired") : t("store.problem.tooLong", { max: REASON_MAX })) : null}>
          <Textarea id="review-reason" rows={3} dir="auto" value={reason} onChange={(event) => setReason(event.target.value)} aria-invalid={show && problem !== null} />
        </Field>
        <DialogFooter className="gap-2"><Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button><Button type="button" variant="destructive" disabled={hide.isPending} onClick={submit}><EyeOff />{t("store.reviews.hide")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StoreReviewsPanel() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const errorText = useStoreErrorText();
  const hidden: HiddenFilter = resolveHiddenFilter(searchParams.get("hidden"));
  const rating = /^[1-5]$/u.test(searchParams.get("rating") ?? "") ? (searchParams.get("rating") as string) : ALL;
  const product = /^\d+$/u.test(searchParams.get("product") ?? "") ? (searchParams.get("product") as string) : ALL;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("page_size") ?? 25) || 25));
  const [hiding, setHiding] = useState<StoreReview | null>(null);

  const updateUrl = useCallback((changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [name, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(name);
      else next.set(name, String(value));
    }
    router.replace(`?${next.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const products = useQuery({
    queryKey: [KEYS.products, "picker"],
    queryFn: async () => normalizeCollection<{ id: number; name: string }>(await apiFetch(`${storePath("products")}?page_size=100&ordering=name`)),
  });
  const query = useQuery({
    queryKey: [REVIEWS_KEY, hidden, rating, product, page, pageSize],
    queryFn: async () => normalizeCollection<StoreReview>(await apiFetch(`${storePath("reviews")}?${reviewQuery({ hidden, rating: rating === ALL ? "" : rating, product: product === ALL ? "" : product, page, pageSize })}`)),
  });

  const unhide = useMutation({
    mutationFn: async (id: number) => { await apiFetch(storePath("reviews", id, "unhide"), { method: "POST", body: {} }); },
    onSuccess() { toast.success(t("store.reviews.unhidden")); for (const name of [REVIEWS_KEY, "store-summary", KEYS.products]) void queryClient.invalidateQueries({ queryKey: [name] }); },
    onError(error) { toast.error(errorText(error)); },
  });
  const filtered = hidden !== "all" || rating !== ALL || product !== ALL;

  return (
    <div className="space-y-4">
      <div className="glass-panel grid gap-3 rounded-2xl border p-3 md:grid-cols-[minmax(0,1fr)_10rem_10rem_auto]">
        <Select value={product} onValueChange={(value) => updateUrl({ product: value === ALL ? null : value, page: 1 })}><SelectTrigger aria-label={t("store.reviews.product")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>{t("store.reviews.allProducts")}</SelectItem>{(products.data?.results ?? []).map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select>
        <Select value={rating} onValueChange={(value) => updateUrl({ rating: value === ALL ? null : value, page: 1 })}><SelectTrigger aria-label={t("store.reviews.rating")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>{t("store.reviews.anyRating")}</SelectItem>{[5, 4, 3, 2, 1].map((value) => <SelectItem key={value} value={String(value)}>{t("store.reviews.stars", { count: value })}</SelectItem>)}</SelectContent></Select>
        <Select value={hidden} onValueChange={(value) => updateUrl({ hidden: value === ALL ? null : value, page: 1 })}><SelectTrigger aria-label={t("common.status")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>{t("store.reviews.anyState")}</SelectItem><SelectItem value="visible">{t("store.reviews.visible")}</SelectItem><SelectItem value="hidden">{t("store.reviews.hiddenOnly")}</SelectItem></SelectContent></Select>
        <div className="flex gap-2">
          {filtered ? <Button variant="ghost" onClick={() => updateUrl({ product: null, rating: null, hidden: null, page: 1 })}>{t("printing.clearFilters")}</Button> : null}
          <Button variant="outline" onClick={() => void query.refetch()}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />{t("common.refresh")}</Button>
        </div>
      </div>

      {query.isPending ? <Skeleton className="h-72 rounded-2xl" /> : query.isError ? <ErrorPanel error={query.error} retry={() => void query.refetch()} /> : (
        <>
          <ul className="space-y-3">
            {query.data.results.map((review) => (
              <li key={review.id} className={`rounded-2xl border p-4 ${review.is_hidden ? "border-destructive/30 bg-destructive/5" : "bg-card"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2"><Stars value={review.rating} />{review.is_hidden ? <Badge variant="destructive" className="rounded-full">{t("store.reviews.hiddenBadge")}</Badge> : null}{review.edit_count > 0 ? <Badge variant="outline" className="rounded-full">{t("store.reviews.edited")}</Badge> : null}</div>
                    <p className="text-sm font-semibold" dir="auto"><button type="button" className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => updateUrl({ product: review.product, page: 1 })}>{review.product_name}</button></p>
                    <p className="text-xs text-muted-foreground"><Link href={`/${locale}/dashboard/users/${review.author.id}`} className="font-medium text-primary underline-offset-4 hover:underline" dir="auto">{review.author.full_name}</Link> · <bdi>{formatDate(review.created_at, locale)}</bdi></p>
                  </div>
                  {review.is_hidden ? (
                    <ConfirmDialog trigger={<Button variant="outline" size="sm" disabled={unhide.isPending}><Eye />{t("store.reviews.unhide")}</Button>} title={t("store.reviews.unhideTitle")} description={t("store.reviews.unhideHint")} confirmLabel={t("store.reviews.unhide")} cancelLabel={t("common.cancel")} onConfirm={() => unhide.mutate(review.id)} />
                  ) : <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setHiding(review)}><EyeOff />{t("store.reviews.hide")}</Button>}
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7" dir="auto">{review.text || <span className="text-muted-foreground">{t("store.reviews.noText")}</span>}</p>
                {review.is_hidden && review.hidden_reason ? <p className="mt-3 rounded-lg bg-background/70 p-2 text-xs text-muted-foreground"><span className="font-semibold">{t("store.reviews.reason")}:</span> <span dir="auto">{review.hidden_reason}</span></p> : null}
              </li>
            ))}
          </ul>
          {!query.data.results.length ? <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">{filtered ? t("store.noMatches") : t("store.reviews.empty")}</div> : null}
          <Pagination page={page} pageSize={pageSize} count={query.data.count} onPage={(next) => updateUrl({ page: next })} onPageSize={(next) => updateUrl({ page_size: next, page: 1 })} />
        </>
      )}
      {hiding ? <HideDialog key={hiding.id} review={hiding} onClose={() => setHiding(null)} /> : null}
    </div>
  );
}
