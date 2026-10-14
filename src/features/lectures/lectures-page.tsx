"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, Globe, RefreshCw, RotateCcw, Upload } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { fetchAllPages, relationLabel } from "@/components/forms/contract-field";
import { Pagination } from "@/components/data-grid/pagination";
import { ResourceTable, type ResourceColumn, type RowMenuAction } from "@/components/data-grid/resource-table";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { PageHeader } from "@/components/shared/page-header";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RESOURCE_DEFINITIONS } from "@/contracts/generated/resource-definitions";
import type { ResourceDefinition } from "@/contracts/types";
import { LectureDetailsDialog } from "@/features/lectures/lecture-details-dialog";
import { LectureEditDialog } from "@/features/lectures/lecture-edit-dialog";
import { lectureErrorText } from "@/features/lectures/lecture-errors";
import {
  LECTURE_STATUSES, lectureActions, lectureQueryFilters, parseLectureParams, pollInterval,
  type LectureRow,
} from "@/features/lectures/lecture-rules";
import { LectureStatusBadge, useLectureStatusLabel } from "@/features/lectures/lecture-status-badge";
import { LectureUploadDialog, SUBJECTS_ENDPOINT } from "@/features/lectures/lecture-upload-dialog";
import { listResource } from "@/features/resources/resource-api";
import { useCan } from "@/features/session";
import { useIdempotencyKey } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages";
import { apiFetch } from "@/lib/api/browser-client";
import { idempotencyConflict } from "@/lib/api/errors";
import { payloadSignature } from "@/lib/api/idempotency";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { formatDate, formatNumber } from "@/lib/utils";

const ALL = "__all__";
const definition = RESOURCE_DEFINITIONS.lectures as ResourceDefinition;

type ActionKind = "publish" | "unpublish" | "retry" | "delete";

function useDocumentHidden(): boolean {
  const [hidden, setHidden] = useState(() => (typeof document === "undefined" ? false : document.hidden));
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    update();
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return hidden;
}

/** Lecture management: list with status filters and auto-refresh, upload with progress, publish, retry, edit, delete, details. */
export function LecturesPage() {
  const { t, locale } = useI18n();
  const statusLabel = useLectureStatusLabel();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const canManage = useCan(CAPABILITIES.lectures);
  const hidden = useDocumentHidden();
  const params = useMemo(() => parseLectureParams(searchParams), [searchParams]);
  const filters = useMemo(() => lectureQueryFilters(params), [params]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [details, setDetails] = useState<LectureRow | null>(null);
  const [editing, setEditing] = useState<LectureRow | null>(null);
  const [pending, setPending] = useState<{ kind: ActionKind; row: LectureRow } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [tick, setTick] = useState(() => Date.now());

  const list = useQuery({
    queryKey: ["lectures", params.page, params.pageSize, filters],
    queryFn: () => listResource(definition, { page: params.page, pageSize: params.pageSize, ordering: "-created_at", filters }),
    enabled: canManage,
    placeholderData: keepPreviousData,
    // Poll only while a visible lecture is still in flight and the tab is visible; back off after failed refreshes.
    refetchInterval: (query) => pollInterval({ rows: query.state.data?.results as LectureRow[] | undefined, hidden, failures: query.state.fetchFailureCount }),
    refetchIntervalInBackground: false,
  });
  const rows = useMemo(() => (list.data?.results ?? []) as unknown as LectureRow[], [list.data]);
  // The clock the stalled rule uses: the last tick or the last fetch, whichever is later.
  const now = Math.max(tick, list.dataUpdatedAt);
  const polling = pollInterval({ rows, hidden: false }) !== false;

  const subjects = useQuery({ queryKey: ["reference-options", SUBJECTS_ENDPOINT], queryFn: () => fetchAllPages(SUBJECTS_ENDPOINT), enabled: canManage, staleTime: 60_000 });

  // "Stalled" is relative to the clock: re-evaluate every minute and whenever fresh data arrives.
  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Announce status changes to assistive technology (polling updates rows silently otherwise).
  const previous = useRef<Map<number, string>>(new Map());
  useEffect(() => {
    if (!rows.length && !list.data) return;
    const changed = rows.filter((row) => previous.current.has(row.id) && previous.current.get(row.id) !== row.status);
    if (changed.length) setAnnouncement(changed.map((row) => t("lectures.live.changed", { title: row.title, status: statusLabel(row.status) })).join(". "));
    previous.current = new Map(rows.map((row) => [row.id, row.status]));
  }, [rows, list.data, statusLabel, t]);

  const updateUrl = useCallback((changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [name, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(name);
      else next.set(name, String(value));
    }
    router.replace(`?${next.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const refreshList = () => { void queryClient.invalidateQueries({ queryKey: ["lectures"] }); };

  const actionKey = useIdempotencyKey();
  const run = useMutation({
    mutationFn: ({ kind, row }: { kind: ActionKind; row: LectureRow }) => {
      const base = `/api/v1/dashboard/lectures/${encodeURIComponent(String(row.id))}/`;
      const idempotencyKey = actionKey.get(payloadSignature("lecture-action", kind, row.id));
      if (kind === "retry") return apiFetch(`${base}retry/`, { method: "POST", idempotencyKey });
      if (kind === "delete") return apiFetch(base, { method: "DELETE", idempotencyKey });
      return apiFetch(base, { method: "PATCH", body: { is_published: kind === "publish" }, idempotencyKey });
    },
    onSuccess(_data, { kind }) {
      actionKey.reset();
      toast.success(t(`lectures.done.${kind}` as MessageKey));
      setPending(null);
      refreshList();
    },
    // Errors are shown inside the confirmation dialog; the key is dropped only for an idempotency "reused" conflict.
    onError: (error) => { if (idempotencyConflict(error) === "reused") actionKey.reset(); },
  });

  const actionsOf = (row: LectureRow) => lectureActions(row, { canManage, now });
  const openAction = (kind: ActionKind, row: LectureRow) => { run.reset(); setPending({ kind, row }); };

  const columns = useMemo<ResourceColumn[]>(() => [
    { key: "id", label: "#" },
    { key: "title", label: t("lectures.col.title"), render: (value) => <span className="block max-w-72 truncate font-medium" title={String(value ?? "")}>{String(value ?? "—")}</span> },
    { key: "subject_name", label: t("lectures.col.subject") },
    { key: "status", label: t("lectures.col.status"), render: (value) => <LectureStatusBadge status={value} /> },
    { key: "page_count", label: t("lectures.col.pages"), render: (value, row) => (row.status === "ready" ? formatNumber(value, locale) : "—") },
    { key: "is_published", label: t("lectures.col.published"), render: (value) => <span className="whitespace-nowrap">{value ? t("lectures.published") : t("lectures.unpublished")}</span> },
    { key: "created_at", label: t("lectures.col.uploaded"), render: (value) => <span className="whitespace-nowrap">{formatDate(value, locale)}</span> },
  ], [t, locale]);

  const rowActions = (row: Record<string, unknown>): RowMenuAction[] => {
    const lecture = row as unknown as LectureRow;
    const allowed = actionsOf(lecture);
    return [
      ...(allowed.publish ? [{ key: "publish", label: t("lectures.action.publish"), icon: <Globe />, onSelect: () => openAction("publish", lecture) }] : []),
      ...(allowed.unpublish ? [{ key: "unpublish", label: t("lectures.action.unpublish"), icon: <EyeOff />, onSelect: () => openAction("unpublish", lecture) }] : []),
      ...(allowed.retry ? [{ key: "retry", label: t("lectures.action.retry"), icon: <RotateCcw />, onSelect: () => openAction("retry", lecture) }] : []),
    ];
  };

  if (!canManage) return <AccessDenied />;

  const statusOptions = LECTURE_STATUSES.map((value) => ({ value, label: statusLabel(value) }));
  const filtered = Boolean(params.subject || params.status || params.isPublished);
  const confirmText = pending ? {
    publish: { title: t("lectures.confirm.publishTitle"), body: t("lectures.confirm.publishBody", { title: pending.row.title }), label: t("lectures.action.publish") },
    unpublish: { title: t("lectures.confirm.unpublishTitle"), body: t("lectures.confirm.unpublishBody", { title: pending.row.title }), label: t("lectures.action.unpublish") },
    retry: { title: t("lectures.confirm.retryTitle"), body: t("lectures.confirm.retryBody", { title: pending.row.title }), label: t("lectures.action.retry") },
    delete: { title: t("lectures.confirm.deleteTitle"), body: t("lectures.confirm.deleteBody", { title: pending.row.title }), label: t("lectures.action.delete") },
  }[pending.kind] : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("lectures.title")}
        description={t("lectures.subtitle")}
        actions={
          <>
            <Button variant="outline" onClick={() => void list.refetch()} disabled={list.isFetching}><RefreshCw className={list.isFetching ? "animate-spin motion-reduce:animate-none" : ""} />{t("common.refresh")}</Button>
            <Button onClick={() => setUploadOpen(true)}><Upload />{t("lectures.upload")}</Button>
          </>
        }
      />

      <div className="glass-panel flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:flex-wrap sm:items-center sm:p-4" role="group" aria-label={t("common.filters")}>
        <Select value={params.subject || ALL} onValueChange={(next) => updateUrl({ subject: next === ALL ? null : next, page: 1 })}>
          <SelectTrigger className="h-11 sm:w-64" aria-label={t("lectures.filter.subject")}><SelectValue placeholder={t("lectures.filter.subject")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("lectures.filter.subject")}: {t("common.all")}</SelectItem>
            {(subjects.data ?? []).map((item) => <SelectItem key={String(item.id)} value={String(item.id)}>{relationLabel(item)}</SelectItem>)}
            {params.subject && !(subjects.data ?? []).some((item) => String(item.id) === params.subject) ? <SelectItem value={params.subject}>#{params.subject}</SelectItem> : null}
          </SelectContent>
        </Select>
        <Select value={params.status || ALL} onValueChange={(next) => updateUrl({ status: next === ALL ? null : next, page: 1 })}>
          <SelectTrigger className="h-11 sm:w-52" aria-label={t("lectures.filter.status")}><SelectValue placeholder={t("lectures.filter.status")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("lectures.filter.status")}: {t("common.all")}</SelectItem>
            {statusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={params.isPublished || ALL} onValueChange={(next) => updateUrl({ is_published: next === ALL ? null : next, page: 1 })}>
          <SelectTrigger className="h-11 sm:w-52" aria-label={t("lectures.filter.published")}><SelectValue placeholder={t("lectures.filter.published")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("lectures.filter.published")}: {t("common.all")}</SelectItem>
            <SelectItem value="true">{t("lectures.published")}</SelectItem>
            <SelectItem value="false">{t("lectures.unpublished")}</SelectItem>
          </SelectContent>
        </Select>
        {filtered ? <Button variant="ghost" onClick={() => updateUrl({ subject: null, status: null, is_published: null, page: 1 })}>{t("common.reset")}</Button> : null}
      </div>

      {polling ? <p className="text-xs text-muted-foreground" data-testid="lectures-auto-refresh">{t("lectures.autoRefresh")}</p> : null}
      <div role="status" aria-live="polite" className="sr-only" data-testid="lectures-live">{announcement}</div>

      {list.isPending ? (
        <div className="space-y-3"><Skeleton className="h-14 rounded-xl" /><Skeleton className="h-80 rounded-xl" /><Skeleton className="h-10 rounded-xl" /></div>
      ) : list.isError && !list.data ? (
        <ErrorPanel error={list.error} retry={() => void list.refetch()} />
      ) : (
        <>
          {list.isError ? <ErrorPanel error={list.error} retry={() => void list.refetch()} /> : null}
          <ResourceTable
            rows={rows as unknown as Record<string, unknown>[]}
            columns={columns}
            canEdit={(row) => actionsOf(row as unknown as LectureRow).edit}
            canDelete={(row) => actionsOf(row as unknown as LectureRow).delete}
            rowActions={rowActions}
            onView={(row) => setDetails(row as unknown as LectureRow)}
            onEdit={(row) => setEditing(row as unknown as LectureRow)}
            onDelete={(row) => openAction("delete", row as unknown as LectureRow)}
            emptyMessage={filtered ? t("lectures.emptyFiltered") : t("lectures.empty")}
          />
          <Pagination page={params.page} pageSize={params.pageSize} count={list.data?.count ?? 0} onPage={(next) => updateUrl({ page: next })} onPageSize={(next) => updateUrl({ page_size: next, page: 1 })} />
        </>
      )}

      {uploadOpen ? <LectureUploadDialog onOpenChange={setUploadOpen} onUploaded={() => { updateUrl({ page: 1 }); refreshList(); }} /> : null}
      {editing ? <LectureEditDialog key={editing.id} lecture={editing} onOpenChange={(open) => { if (!open) setEditing(null); }} onSaved={refreshList} /> : null}
      <LectureDetailsDialog lecture={details} now={now} onOpenChange={(open) => { if (!open) setDetails(null); }} />

      <AlertDialog open={Boolean(pending)} onOpenChange={(open) => { if (!open && !run.isPending) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmText?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmText?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          {run.error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{lectureErrorText(run.error, t, pending?.kind === "retry" ? "retry" : "action")}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={run.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={run.isPending}
              className={pending?.kind === "delete" ? "bg-destructive text-destructive-foreground" : undefined}
              onClick={(event) => { event.preventDefault(); if (pending) run.mutate(pending); }}
            >
              {confirmText?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

