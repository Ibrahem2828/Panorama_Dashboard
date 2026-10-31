"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, MessageSquareText, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { Pagination } from "@/components/data-grid/pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { Ltr } from "@/components/shared/ltr";
import { RATING_VALUES, RatingFace } from "@/components/shared/rating-face";
import { RATING_SUMMARY_KEYS, RatingSummary } from "@/features/feedback/rating-summary";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ResourceManager } from "@/features/resources/resource-manager";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { apiFetch, normalizeCollection, unwrap } from "@/lib/api/browser-client";
import { useAssignees } from "@/features/staff/use-assignees";
import { useIdempotencyKey, useMutationError } from "@/hooks/use-idempotency-key";
import { payloadSignature } from "@/lib/api/idempotency";
import { useI18n } from "@/i18n/provider";
import type { ApiEnvelope } from "@/types/api";

export interface FeedbackItem {
  id: number; user_name: string; kind: string; metric_type: string; metric_value?: number | null; rating?: number | null;
  title: string; comment: string; suggestion: string; status: string; priority: string; assigned_to?: number | null;
  assigned_to_name?: string; internal_notes: string; resolution_message: string; platform: string; app_version: string;
  locale: string; votes_count: number; created_at: string;
}
/** Smiley ratings are 1..5: `rating`, or CSAT `metric_value`. Other metrics (NPS 0-10, CES) keep their number. */
function ratingOf(item: FeedbackItem): number | null {
  const value = item.rating ?? (item.metric_type === "csat" ? item.metric_value : null);
  return value === null || value === undefined ? null : Number(value);
}
export function RatingCell({ item }: { item: FeedbackItem }) {
  const { locale } = useI18n();
  const rating = ratingOf(item);
  if (rating !== null) return <RatingFace value={rating} />;
  return <span>{formatNumber(item.metric_value, locale)}</span>;
}
const statuses = ["new", "reviewing", "planned", "in_progress", "resolved", "rejected", "duplicate"];
const priorities = ["low", "normal", "high", "critical"];

function AnalyticsPanel() {
  const { t, tOr, locale } = useI18n();
  const query = useQuery({ queryKey: ["feedback-analytics"], queryFn: async () => unwrap(await apiFetch<ApiEnvelope<Record<string, unknown>> | Record<string, unknown>>("/api/v1/dashboard/feedback-analytics/")) });
  const entries = useMemo(() => Object.entries(query.data ?? {}).filter(([key, value]) => !RATING_SUMMARY_KEYS.includes(key) && ["string", "number", "boolean"].includes(typeof value)).slice(0, 12), [query.data]);
  if (query.isPending) return <div className="grid gap-3 md:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>;
  if (query.isError) return <ErrorPanel error={query.error} retry={() => query.refetch()} />;
  const summary = <RatingSummary average={query.data?.average_rating} total={query.data?.total_ratings} distribution={query.data?.rating_distribution} />;
  return <div className="space-y-4">{summary}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{entries.map(([key, value]) => <Card key={key}><CardHeader className="pb-2"><CardDescription>{tOr(`metric.feedback.${key}`, tOr(`metric.${key}`, t("metric.other")))}</CardDescription><CardTitle>{typeof value === "number" ? formatNumber(value, locale) : typeof value === "boolean" ? t(value ? "common.yes" : "common.no") : String(value)}</CardTitle></CardHeader></Card>)}{!entries.length ? <Card className="sm:col-span-2"><CardContent className="p-8 text-center text-muted-foreground">{t("common.noData")}</CardContent></Card> : null}</div></div>;
}

function WorkflowPanel() {
  const { t, enumLabel, locale } = useI18n();
  const queryClient = useQueryClient();
  const [searchDraft, setSearchDraft] = useState("");
  const search = useDebouncedValue(searchDraft);
  const [status, setStatus] = useState("all");
  const [rating, setRating] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<FeedbackItem | null>(null);
  const [nextStatus, setNextStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [resolution, setResolution] = useState("");

  const query = useQuery({ queryKey: ["feedback", search, status, rating, page, pageSize], queryFn: async () => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize), ordering: "-created_at" });
    if (search) params.set("search", search); if (status !== "all") params.set("status", status);
    if (rating !== "all") params.set("rating", rating);
    return normalizeCollection<FeedbackItem>(await apiFetch(`/api/v1/dashboard/feedback/?${params}`));
  }});
  const assignees = useAssignees("feedback");
  const saveKey = useIdempotencyKey();
  const saveError = useMutationError(saveKey);
  const save = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Missing feedback item");
      const body = {
        status: nextStatus || selected.status,
        priority: priority || selected.priority,
        assigned_to: assignedTo && assignedTo !== "unassigned" ? Number(assignedTo) : null,
        internal_notes: internalNotes || selected.internal_notes,
        resolution_message: resolution || selected.resolution_message,
      };
      return apiFetch(`/api/v1/dashboard/feedback/${selected.id}/workflow/`, { method: "PATCH", body, idempotencyKey: saveKey.get(payloadSignature(selected.id, body)) });
    },
    onSuccess() { saveKey.reset(); toast.success(t("common.success")); setSelected(null); void queryClient.invalidateQueries({ queryKey: ["feedback"] }); void queryClient.invalidateQueries({ queryKey: ["feedback-analytics"] }); },
    onError: saveError,
  });

  const open = (item: FeedbackItem) => { setSelected(item); setNextStatus(item.status); setPriority(item.priority); setAssignedTo(item.assigned_to ? String(item.assigned_to) : "unassigned"); setInternalNotes(item.internal_notes); setResolution(item.resolution_message); };
  return <div className="space-y-4">
    <div className="glass-panel flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="ps-10" value={searchDraft} onChange={(event) => { setSearchDraft(event.target.value); setPage(1); }} placeholder={t("common.searchPlaceholder")} aria-label={t("common.search")} /></div><Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}><SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("common.all")}</SelectItem>{statuses.map((value) => <SelectItem key={value} value={value}>{enumLabel(value)}</SelectItem>)}</SelectContent></Select><Select value={rating} onValueChange={(value) => { setRating(value); setPage(1); }}><SelectTrigger className="sm:w-52" aria-label={t("feedback.rating")}><SelectValue placeholder={t("feedback.rating")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("feedback.rating")}: {t("common.all")}</SelectItem>{RATING_VALUES.map((value) => <SelectItem key={value} value={String(value)}><RatingFace value={value} size={20} /></SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={() => query.refetch()}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />{t("common.refresh")}</Button></div>
    {query.isPending ? <Skeleton className="h-96" /> : query.isError ? <ErrorPanel error={query.error} retry={() => query.refetch()} /> : <div className="overflow-hidden rounded-2xl border bg-card"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/60 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-start">#</th><th className="p-3 text-start">{t("feedback.type")}</th><th className="p-3 text-start">{t("feedback.content")}</th><th className="p-3 text-start">{t("feedback.rating")}</th><th className="p-3 text-start">{t("common.status")}</th><th className="p-3 text-start">{t("feedback.priority")}</th><th className="p-3 text-start">{t("common.actions")}</th></tr></thead><tbody>{query.data.results.map((item) => <tr key={item.id} className="border-t hover:bg-muted/30"><td className="p-3 font-mono">{item.id}</td><td className="p-3">{enumLabel(item.kind)}</td><td className="max-w-md p-3"><p className="font-semibold">{item.title || item.suggestion || item.comment || "—"}</p><p className="line-clamp-1 text-xs text-muted-foreground">{item.user_name} · {enumLabel(item.platform)} <Ltr as="span">{item.app_version}</Ltr></p></td><td className="p-3"><RatingCell item={item} /></td><td className="p-3"><StatusPill value={item.status} /></td><td className="p-3"><StatusPill value={item.priority} /></td><td className="p-3"><Button size="sm" variant="outline" onClick={() => open(item)}><MessageSquareText />{t("feedback.workflow")}</Button></td></tr>)}</tbody></table></div>{!query.data.results.length ? <div className="p-10 text-center text-muted-foreground">{t("common.noData")}</div> : null}</div>}
    {query.data ? <Pagination page={page} pageSize={pageSize} count={query.data.count} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1); }} /> : null}
    <Dialog open={Boolean(selected)} onOpenChange={(value) => { if (!value) setSelected(null); }}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{selected?.title || `${t("feedback.title")} #${selected?.id}`}</DialogTitle><DialogDescription>{selected?.user_name} · {enumLabel(selected?.kind)}</DialogDescription>{selected && ratingOf(selected) !== null ? <RatingCell item={selected} /> : null}</DialogHeader>{selected ? <div className="grid gap-5 lg:grid-cols-2"><div className="space-y-3"><Card><CardHeader><CardTitle className="text-base">{t("feedback.content")}</CardTitle></CardHeader><CardContent className="space-y-3 whitespace-pre-wrap text-sm text-muted-foreground">{selected.comment ? <p>{selected.comment}</p> : null}{selected.suggestion ? <p>{selected.suggestion}</p> : null}{!selected.comment && !selected.suggestion ? <p>—</p> : null}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">{t("feedback.metadata")}</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>{enumLabel(selected.platform)}</span><Ltr as="span">{selected.app_version}</Ltr><Ltr as="span">{selected.locale}</Ltr><span>{t("feedback.votes", { count: formatNumber(selected.votes_count, locale) })}</span></CardContent></Card></div><div className="space-y-3"><div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>{t("common.status")}</Label><Select value={nextStatus} onValueChange={setNextStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((value) => <SelectItem key={value} value={value}>{enumLabel(value)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>{t("feedback.priority")}</Label><Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{priorities.map((value) => <SelectItem key={value} value={value}>{enumLabel(value)}</SelectItem>)}</SelectContent></Select></div></div><div className="space-y-2"><Label>{t("support.assign")}</Label><Select value={assignedTo} onValueChange={setAssignedTo}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unassigned">{t("support.unassigned")}</SelectItem>{assignees.options.map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>)}</SelectContent></Select>{assignees.limited ? <p className="text-xs leading-5 text-muted-foreground">{t("assignees.limited")}</p> : null}</div><div className="space-y-2"><Label>{t("feedback.internalNotes")}</Label><Textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} /></div><div className="space-y-2"><Label>{t("feedback.resolution")}</Label><Textarea value={resolution} onChange={(event) => setResolution(event.target.value)} /></div></div></div> : null}<DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>{t("common.cancel")}</Button><Button onClick={() => save.mutate()} disabled={save.isPending}>{t("common.save")}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

export function FeedbackPage() {
  const { t } = useI18n();
  return <CapabilityGate capability={CAPABILITIES.feedback}><div className="space-y-6"><PageHeader title={t("feedback.title")} description={t("feedback.subtitle")} eyebrow={t("eyebrow.voiceOfUser")} /><Tabs defaultValue="workflow" className="space-y-4"><TabsList><TabsTrigger value="workflow"><MessageSquareText />{t("feedback.workflow")}</TabsTrigger><TabsTrigger value="analytics"><BarChart3 />{t("feedback.analytics")}</TabsTrigger><TabsTrigger value="prompts">{t("feedback.promptPolicies")}</TabsTrigger></TabsList><TabsContent value="workflow"><WorkflowPanel /></TabsContent><TabsContent value="analytics"><AnalyticsPanel /></TabsContent><TabsContent value="prompts"><ResourceManager resourceKey="feedback-prompt-policies" title={t("feedback.promptPolicies")} capability={CAPABILITIES.feedback} /></TabsContent></Tabs></div></CapabilityGate>;
}
