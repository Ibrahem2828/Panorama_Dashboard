"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, DownloadCloud, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorPanel } from "@/components/feedback/error-panel";
import { Ltr } from "@/components/shared/ltr";
import { StatusPill } from "@/components/shared/status-pill";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  STAFF_LIST_CAP, activeCount, groupByLecture, maskDevice, offlineLicensesPath, revokeBody, revokeReasonKey,
  revokedCount, shouldShowReason, stateLabelKey, statePillValue, type OfflineLicenseRow,
} from "@/features/lectures/offline-license-rules";
import { useCan } from "@/features/session";
import { useIdempotencyKey, useMutationError } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import { localizePath } from "@/i18n/routing";
import { apiFetch, unwrap } from "@/lib/api/browser-client";
import { payloadSignature } from "@/lib/api/idempotency";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { formatDate, formatNumber } from "@/lib/utils";

/** List of offline licenses for one filter (`user` and/or `lecture`); staff with `lectures.manage` only. */
function useOfflineLicenses(filter: { user?: number; lecture?: number }) {
  const canManage = useCan(CAPABILITIES.lectures);
  return useQuery({
    queryKey: ["offline-licenses", filter.user ?? null, filter.lecture ?? null],
    enabled: canManage,
    queryFn: async () => {
      const data = await unwrap(apiFetch<unknown>(offlineLicensesPath(filter)));
      return Array.isArray(data) ? (data as OfflineLicenseRow[]) : [];
    },
  });
}

type Pending = { lectureId?: number; title?: string } | null;

/** «التنزيلات بدون إنترنت» tab of a user profile: licenses grouped by lecture with per-lecture and global revoke. */
export function OfflineLicensesPanel({ userId, userName }: { userId: number; userName: string }) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const list = useOfflineLicenses({ user: userId });
  const key = useIdempotencyKey();
  const onError = useMutationError(key);
  const [pending, setPending] = useState<Pending>(null);
  const run = useMutation({
    mutationFn: async (target: NonNullable<Pending>) => {
      const body = revokeBody(userId, target.lectureId);
      return unwrap(apiFetch<unknown>("/api/v1/dashboard/lectures/offline-licenses/revoke/", {
        method: "POST", body, idempotencyKey: key.get(payloadSignature("offline-revoke", body)),
      }));
    },
    onSuccess: async (payload) => {
      key.reset();
      toast.success(t("offlineLicenses.revoked", { count: formatNumber(revokedCount(payload), locale) }));
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: ["offline-licenses"] });
    },
    onError: (error) => { onError(error); setPending(null); },
  });

  if (list.isPending) return <div className="space-y-3" aria-busy="true"><Skeleton className="h-24 w-full rounded-xl" /><Skeleton className="h-24 w-full rounded-xl" /></div>;
  if (list.isError) return <ErrorPanel error={list.error} retry={() => void list.refetch()} />;
  const groups = groupByLecture(list.data);
  const revocableTotal = groups.reduce((sum, group) => sum + group.revocable, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t("offlineLicenses.summary", { active: formatNumber(activeCount(list.data), locale), total: formatNumber(list.data.length, locale) })}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={list.isFetching} onClick={() => void list.refetch()}>
            <RefreshCw className={list.isFetching ? "animate-spin" : undefined} aria-hidden />{t("offlineLicenses.refresh")}
          </Button>
          <Button type="button" size="sm" variant="destructive" disabled={revocableTotal === 0 || run.isPending} onClick={() => setPending({})}>
            <Ban aria-hidden />{t("offlineLicenses.revokeAll")}
          </Button>
        </div>
      </div>
      {groups.length === 0 ? (
        <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">{t("offlineLicenses.empty")}</p>
      ) : groups.map((group) => (
        <section key={group.lectureId} className="overflow-hidden rounded-xl border bg-card" aria-label={group.title}>
          <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
            <h3 className="min-w-0 break-words text-sm font-bold" dir="auto">{group.title}<span className="ms-2 text-xs font-normal tabular-nums text-muted-foreground">#{group.lectureId}</span></h3>
            <Button type="button" size="sm" variant="outline" disabled={group.revocable === 0 || run.isPending} onClick={() => setPending({ lectureId: group.lectureId, title: group.title })}>
              <Ban aria-hidden />{t("offlineLicenses.revoke")}
            </Button>
          </header>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>{t("offlineLicenses.device")}</TableHead><TableHead>{t("offlineLicenses.issuedAt")}</TableHead><TableHead>{t("offlineLicenses.expiresAt")}</TableHead><TableHead>{t("common.status")}</TableHead></TableRow></TableHeader>
              <TableBody>{group.rows.map((row) => <LicenseRow key={row.license_id} row={row} />)}</TableBody>
            </Table>
          </div>
        </section>
      ))}
      {list.data.length >= STAFF_LIST_CAP ? <p className="text-xs text-muted-foreground">{t("offlineLicenses.capped", { count: STAFF_LIST_CAP })}</p> : null}
      <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open && !run.isPending) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.lectureId === undefined ? t("offlineLicenses.confirmAllTitle") : t("offlineLicenses.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.lectureId === undefined ? t("offlineLicenses.confirmAllDescription", { name: userName }) : t("offlineLicenses.confirmDescription", { name: userName, lecture: pending.title ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={run.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={run.isPending} className="bg-destructive text-destructive-foreground" onClick={(event) => { event.preventDefault(); if (pending) run.mutate(pending); }}>{t("form.confirmAction")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LicenseRow({ row }: { row: OfflineLicenseRow }) {
  const { t, locale } = useI18n();
  const reasonKey = revokeReasonKey(row.revoke_reason);
  return (
    <TableRow data-state={row.state}>
      <TableCell><Ltr><span className="font-mono text-xs" title={t("offlineLicenses.deviceHint")}>{maskDevice(row.device)}</span></Ltr></TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(row.issued_at, locale)}</TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(row.expires_at, locale)}</TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill value={statePillValue(row.state)} label={t(stateLabelKey(row.state))} />
          {shouldShowReason(row) ? (
            <span className="text-xs text-muted-foreground">{reasonKey ? t(reasonKey) : row.revoke_reason}{row.revoked_at ? ` · ${formatDate(row.revoked_at, locale)}` : ""}</span>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

/** Small panel of the lecture details: how many students hold an active offline copy, with links to their profiles. */
export function LectureOfflineSummary({ lectureId }: { lectureId: number }) {
  const { t, locale } = useI18n();
  const canManage = useCan(CAPABILITIES.lectures);
  const list = useOfflineLicenses({ lecture: lectureId });
  if (!canManage) return null;
  const active = list.data ? list.data.filter((row) => row.state === "active") : [];
  const users = [...new Set(active.map((row) => row.user_id))];
  return (
    <section className="rounded-xl border bg-muted/30 p-3 sm:col-span-2" aria-label={t("offlineLicenses.lecturePanel")}>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><DownloadCloud className="size-4" aria-hidden />{t("offlineLicenses.lecturePanel")}</div>
      {list.isPending ? <Skeleton className="mt-2 h-5 w-48" /> : list.isError ? (
        <p className="mt-1 text-sm text-destructive" role="alert">{t("offlineLicenses.loadFailed")} <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => void list.refetch()}>{t("offlineLicenses.retry")}</Button></p>
      ) : (
        <>
          <p className="mt-1 text-sm">{active.length === 0 ? t("offlineLicenses.lectureNone") : t("offlineLicenses.lectureCount", { licenses: formatNumber(active.length, locale), users: formatNumber(users.length, locale) })}{list.data.length >= STAFF_LIST_CAP ? ` (${t("offlineLicenses.capped", { count: STAFF_LIST_CAP })})` : ""}</p>
          {users.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {users.slice(0, 12).map((id) => (
                <li key={id}><Link className="rounded-full border bg-background px-2 py-0.5 text-xs hover:underline" href={`${localizePath(locale, `/dashboard/users/${id}`)}?tab=offline`}>#{id}</Link></li>
              ))}
              {users.length > 12 ? <li className="text-xs text-muted-foreground">+{formatNumber(users.length - 12, locale)}</li> : null}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}
