"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCheck, ExternalLink, Info, RefreshCw, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Pagination } from "@/components/data-grid/pagination";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { EMPTY_LOOKUPS, academicFields, useAcademicLookups } from "@/components/filters/academic-filters";
import { FilterBar, FilterEmptyState, type FilterSegment } from "@/components/filters/filter-bar";
import { toQueryString } from "@/components/filters/filter-state";
import { LOOKUPS, useLookupOptions } from "@/components/filters/use-lookup-options";
import { useFilterState } from "@/components/filters/use-filter-state";
import { Ltr } from "@/components/shared/ltr";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { KIND_LABEL_KEY, type GroupKind } from "@/features/groups/groups-filters";
import { membershipRequest } from "@/features/groups/group-rules";
import {
  BULK_LIMIT, JOIN_REQUESTS_BULK_PATH, JOIN_REQUESTS_PATH, JOIN_REQUESTS_SUMMARY_PATH, SUBJECT_REGISTRATION_ROUTE,
  failedResults, joinRequestFields, joinRequestListParams, joinRequestSchema, joinRequestSummaryParams, normalizeBulkResults,
  type BulkDecision, type BulkItemResult, type JoinRequestRow, type JoinRequestSummary,
} from "@/features/groups/join-requests-rules";
import { formatRelativeAge } from "@/features/printing/printers-rules";
import { useCan } from "@/features/session";
import { UserLink } from "@/features/users/user-link";
import { useIdempotencyKey, useMutationError } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import { localizePath } from "@/i18n/routing";
import { apiFetch, normalizeCollection, unwrap } from "@/lib/api/browser-client";
import { payloadSignature } from "@/lib/api/idempotency";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { formatDate, formatNumber } from "@/lib/utils";

type ReasonRequest = { kind: "reject"; row: JoinRequestRow } | { kind: "bulk-reject"; ids: number[] };

function RelativeTime({ value }: { value: string | null | undefined }) {
  const { locale } = useI18n();
  if (!value) return <span>—</span>;
  const absolute = formatDate(value, locale);
  return <time dateTime={value} title={absolute} className="whitespace-nowrap">{formatRelativeAge(value, locale) ?? absolute}</time>;
}

/** Group join requests: the dedicated review screen (old pending requests only; students now enter groups through subject registration). */
export function JoinRequestsPage() {
  const { t, tOr, locale, enumLabel } = useI18n();
  const queryClient = useQueryClient();
  const allowed = useCan(CAPABILITIES.groups);
  const searchParams = useSearchParams();
  const highlight = searchParams?.get("highlight") ?? "";

  const [moreOpened, setMoreOpened] = useState(false);
  const structure = useMemo(() => joinRequestSchema(joinRequestFields({ t, academic: academicFields(t, EMPTY_LOOKUPS), groups: [], subjects: [] })), [t]);
  const state = useFilterState(structure);
  const academic = useAcademicLookups(allowed);
  const groups = useLookupOptions(LOOKUPS.groups, {}, allowed);
  const subjects = useLookupOptions(LOOKUPS.subjects, {}, allowed && (moreOpened || Boolean(state.values.subject)));
  const fields = useMemo(() => joinRequestFields({ t, academic: academicFields(t, academic), groups: groups.options, subjects: subjects.options }), [t, academic, groups.options, subjects.options]);

  const status = state.values.status || "pending";
  const listParams = joinRequestListParams(state.requestParams);
  const list = useQuery({
    queryKey: ["group-join-requests", listParams, state.page, state.pageSize],
    queryFn: async () => normalizeCollection<JoinRequestRow>(await apiFetch(`${JOIN_REQUESTS_PATH}?${toQueryString(listParams, { page: state.page, page_size: state.pageSize })}`)),
    enabled: allowed,
    placeholderData: keepPreviousData,
  });
  const summaryParams = joinRequestSummaryParams(state.requestParams);
  const summary = useQuery({
    queryKey: ["group-join-requests-summary", summaryParams],
    queryFn: async () => unwrap(apiFetch<JoinRequestSummary>(`${JOIN_REQUESTS_SUMMARY_PATH}?${toQueryString(summaryParams)}`)),
    enabled: allowed,
    placeholderData: keepPreviousData,
  });

  const segments = useMemo<FilterSegment[]>(() => [
    { value: "", label: t("joinRequests.segment.pending"), count: summary.data?.pending },
    { value: "approved", label: t("joinRequests.segment.approved") },
    { value: "rejected", label: t("joinRequests.segment.rejected") },
  ], [summary.data, t]);

  const rows = useMemo(() => list.data?.results ?? [], [list.data]);
  const reviewable = useMemo(() => rows.filter((row) => row.status === "pending"), [rows]);

  // Selection only ever holds rows that are still on screen (a filter, page or refresh change drops the others).
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const selected = useMemo(() => reviewable.filter((row) => picked.has(row.id)).map((row) => row.id), [reviewable, picked]);
  const toggle = (id: number) => setPicked((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const allSelected = reviewable.length > 0 && selected.length === reviewable.length;
  const toggleAll = () => setPicked(allSelected ? new Set() : new Set(reviewable.slice(0, BULK_LIMIT).map((row) => row.id)));

  const [reasonFor, setReasonFor] = useState<ReasonRequest | null>(null);
  const [reason, setReason] = useState("");
  const [failures, setFailures] = useState<{ decision: BulkDecision; results: BulkItemResult[]; total: number } | null>(null);

  const key = useIdempotencyKey();
  const onError = useMutationError(key);
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["group-join-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["group-join-requests-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["quick-access"] }),
      queryClient.invalidateQueries({ queryKey: ["group-members"] }),
    ]);
  };

  const single = useMutation({
    mutationFn: ({ action, row, note }: { action: "approve" | "reject"; row: JoinRequestRow; note?: string }) => {
      const request = membershipRequest(action, row.id);
      return apiFetch(request.path, { method: request.method, body: note ? { note } : undefined, idempotencyKey: key.get(payloadSignature(action, row.id, note ?? "")) });
    },
    onSuccess: async () => {
      key.reset();
      toast.success(t("common.success"));
      setReasonFor(null); setReason("");
      await refresh();
    },
    onError: (error) => { onError(error); setReasonFor(null); },
  });

  const bulk = useMutation({
    mutationFn: async ({ ids, decision, note }: { ids: number[]; decision: BulkDecision; note?: string }) => {
      const response = await apiFetch(JOIN_REQUESTS_BULK_PATH, {
        method: "POST", body: { ids, decision, ...(note ? { note } : {}) }, idempotencyKey: key.get(payloadSignature(decision, ids.join(","), note ?? "")),
      });
      return { decision, ids, results: normalizeBulkResults(await unwrap(response), ids) };
    },
    onSuccess: async ({ decision, ids, results }) => {
      key.reset();
      const failed = failedResults(results);
      setReasonFor(null); setReason("");
      // Only the rows that failed stay ticked, so the admin can look at them and try again.
      setPicked(new Set(failed.map((item) => item.id)));
      if (failed.length === 0) toast.success(t("joinRequests.bulk.allDone", { count: formatNumber(ids.length, locale) }));
      else setFailures({ decision, results: failed, total: ids.length });
      await refresh();
    },
    onError: (error) => { onError(error); setReasonFor(null); },
  });

  const busy = single.isPending || bulk.isPending;
  const confirmReason = () => {
    if (!reasonFor) return;
    const note = reason.trim() || undefined;
    if (reasonFor.kind === "reject") single.mutate({ action: "reject", row: reasonFor.row, note });
    else bulk.mutate({ ids: reasonFor.ids, decision: "reject", note });
  };
  const closeReason = () => { if (!busy) { setReasonFor(null); setReason(""); } };

  // Deep link: bring the highlighted request into view once it is on screen.
  useEffect(() => {
    if (!highlight) return;
    document.querySelector(`[data-testid="join-request-${highlight.replace(/\D/gu, "")}"]`)?.scrollIntoView?.({ block: "center" });
  }, [highlight, rows]);

  const nameOfFailed = (id: number) => rows.find((row) => row.id === id)?.user.full_name ?? `#${id}`;
  const errorText = (error?: string) => (error && error !== "missing" ? tOr(`joinRequests.error.${error}`, error) : t("joinRequests.error.generic"));

  if (!allowed) return <AccessDenied />;
  const showBulk = status === "pending" && reviewable.length > 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("joinRequests.title")}
        description={t("joinRequests.subtitle")}
        eyebrow={t("nav.content")}
        actions={<Button variant="outline" onClick={() => void refresh()} disabled={list.isFetching}><RefreshCw className={list.isFetching ? "animate-spin motion-reduce:animate-none" : ""} />{t("common.refresh")}</Button>}
      />

      <div role="note" data-testid="join-requests-banner" className="flex flex-col gap-3 rounded-xl border border-gold/40 bg-gold/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm leading-7"><Info className="mt-1 size-4 shrink-0" aria-hidden />{t("joinRequests.banner")}</p>
        <Button asChild variant="outline" className="shrink-0">
          <Link href={localizePath(locale, SUBJECT_REGISTRATION_ROUTE)}>{t("joinRequests.bannerLink")}<ExternalLink className="directional-icon" aria-hidden /></Link>
        </Button>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3" aria-label={t("joinRequests.summary")}>
        {([["pending", summary.data?.pending], ["approvedToday", summary.data?.approved_today], ["rejectedToday", summary.data?.rejected_today]] as const).map(([name, value]) => (
          <div key={name} className="rounded-xl border bg-card p-3" data-testid={`join-summary-${name}`}>
            <dt className="text-xs text-muted-foreground">{t(`joinRequests.summary.${name}` as "joinRequests.summary.pending")}</dt>
            <dd className="text-2xl font-black tabular-nums">{value === undefined ? "—" : formatNumber(value, locale)}</dd>
          </div>
        ))}
      </dl>

      <FilterBar
        state={state}
        fields={fields}
        segments={segments}
        searchPlaceholder={t("joinRequests.search")}
        resultCount={list.data?.count ?? null}
        loading={list.isFetching && !list.isPending}
        onMoreOpenChange={(opened) => { if (opened) setMoreOpened(true); }}
      />

      {list.isPending ? (
        <div className="space-y-3" aria-busy="true"><Skeleton className="h-14 rounded-xl" /><Skeleton className="h-80 rounded-xl" /></div>
      ) : list.isError && !list.data ? (
        <ErrorPanel error={list.error} retry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        <FilterEmptyState state={state} message={t(status === "pending" ? "joinRequests.emptyPending" : "joinRequests.empty")} />
      ) : (
        <>
          {showBulk && selected.length > 0 ? (
            <div role="region" aria-label={t("joinRequests.bulk.bar")} data-testid="bulk-bar" className="sticky top-[calc(var(--app-topbar-height,4rem)+0.5rem)] z-20 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-md">
              <span className="me-auto text-sm font-semibold" aria-live="polite">{t("joinRequests.bulk.selected", { count: formatNumber(selected.length, locale) })}</span>
              <Button size="sm" disabled={busy} onClick={() => bulk.mutate({ ids: selected, decision: "approve" })}><CheckCheck />{t("joinRequests.bulk.approve")}</Button>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => setReasonFor({ kind: "bulk-reject", ids: selected })}><XCircle />{t("joinRequests.bulk.reject")}</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPicked(new Set())}>{t("joinRequests.bulk.clear")}</Button>
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/55">
                  <TableHead className="w-10">
                    {showBulk ? <input type="checkbox" aria-label={t("joinRequests.selectAll")} checked={allSelected} onChange={toggleAll} /> : null}
                  </TableHead>
                  <TableHead>{t("joinRequests.col.student")}</TableHead>
                  <TableHead>{t("joinRequests.col.group")}</TableHead>
                  <TableHead>{t("joinRequests.col.requested")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("joinRequests.col.reviewer")}</TableHead>
                  <TableHead><span className="sr-only">{t("common.actions")}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const open = row.status === "pending";
                  const marked = highlight === String(row.id);
                  const kind = row.group.kind as GroupKind;
                  return (
                    <TableRow key={row.id} data-testid={`join-request-${row.id}`} data-highlighted={marked ? "true" : undefined} className={marked ? "bg-gold/10 ring-2 ring-inset ring-gold/60" : undefined}>
                      <TableCell>
                        {open && status === "pending" ? <input type="checkbox" aria-label={row.user.full_name} checked={picked.has(row.id)} onChange={() => toggle(row.id)} /> : null}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium"><UserLink userId={row.user.id} name={row.user.full_name} /></div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {row.user.student_number ? <Ltr as="span">{row.user.student_number}</Ltr> : null}
                          <StatusPill value={row.user.verification_status} label={tOr(`students.status.${row.user.verification_status}`, row.user.verification_status)} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{row.group.name}</span>
                          <Badge variant="outline">{KIND_LABEL_KEY[kind] ? t(KIND_LABEL_KEY[kind]) : row.group.kind}</Badge>
                        </div>
                        {row.group.subject ? <div className="mt-1 text-xs text-muted-foreground">{row.group.subject.name}</div> : null}
                      </TableCell>
                      <TableCell className="text-sm"><RelativeTime value={row.created_at} /></TableCell>
                      <TableCell>
                        <StatusPill value={row.status} label={tOr(`joinRequests.status.${row.status}`, enumLabel(row.status))} />
                        {row.note ? <div className="mt-1 max-w-48 text-xs text-muted-foreground">{row.note}</div> : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.reviewed_by ? (<><div>{row.reviewed_by.full_name}</div><div className="text-xs text-muted-foreground"><RelativeTime value={row.reviewed_at} /></div></>) : "—"}
                      </TableCell>
                      <TableCell>
                        {open ? (
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button size="sm" disabled={busy} aria-label={`${t("groups.action.approve")}: ${row.user.full_name}`} onClick={() => single.mutate({ action: "approve", row })}><Check />{t("groups.action.approve")}</Button>
                            <Button size="sm" variant="outline" disabled={busy} aria-label={`${t("groups.action.reject")}: ${row.user.full_name}`} onClick={() => setReasonFor({ kind: "reject", row })}><X />{t("groups.action.reject")}</Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination page={state.page} pageSize={state.pageSize} count={list.data?.count ?? 0} onPage={state.setPage} onPageSize={state.setPageSize} />
        </>
      )}

      <Dialog open={reasonFor !== null} onOpenChange={(next) => { if (!next) closeReason(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("joinRequests.reason.title")}</DialogTitle>
            <DialogDescription>
              {reasonFor?.kind === "reject"
                ? t("joinRequests.reason.single", { name: reasonFor.row.user.full_name, group: reasonFor.row.group.name })
                : t("joinRequests.reason.bulk", { count: formatNumber(reasonFor?.kind === "bulk-reject" ? reasonFor.ids.length : 0, locale) })}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={reason} maxLength={500} autoFocus aria-label={t("joinRequests.reason.label")} placeholder={t("joinRequests.reason.placeholder")} onChange={(event) => setReason(event.target.value)} />
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={closeReason}>{t("common.cancel")}</Button>
            <Button variant="destructive" disabled={busy} onClick={confirmReason}>{t("joinRequests.reason.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={failures !== null} onOpenChange={(next) => { if (!next) setFailures(null); }}>
        <DialogContent data-testid="bulk-results">
          <DialogHeader>
            <DialogTitle>{t("joinRequests.bulk.partialTitle")}</DialogTitle>
            <DialogDescription>
              {failures ? t("joinRequests.bulk.partialBody", { done: formatNumber(failures.total - failures.results.length, locale), total: formatNumber(failures.total, locale), failed: formatNumber(failures.results.length, locale) }) : ""}
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {failures?.results.map((item) => (
              <li key={item.id} className="rounded-lg border p-2" data-testid={`bulk-failure-${item.id}`}>
                <span className="font-semibold">{nameOfFailed(item.id)}</span>
                <span className="block text-xs text-destructive">{errorText(item.error)}</span>
              </li>
            ))}
          </ul>
          <DialogFooter><Button onClick={() => setFailures(null)}>{t("common.close")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
