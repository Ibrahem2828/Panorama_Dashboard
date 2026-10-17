"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Skull, UserRoundX } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { ResourceColumn } from "@/components/data-grid/resource-table";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Ltr } from "@/components/shared/ltr";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { canExecuteDeletion, deletionPath, emailMatches, isPendingDeletion, userBrief } from "@/features/governance/deletion-rules";
import { ResourceManager, type ManagerCustomAction, type ManagerFilter, type ManagerRowAction } from "@/features/resources/resource-manager";
import type { EntityRecord } from "@/features/resources/resource-api";
import { useSession } from "@/features/session";
import { useIdempotencyKey, useMutationError } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import { apiFetch, unwrap } from "@/lib/api/browser-client";
import { apiErrorText } from "@/lib/api/error-message";
import { payloadSignature } from "@/lib/api/idempotency";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { formatDate, formatNumber } from "@/lib/utils";
import type { ApiEnvelope } from "@/types/api";

const STATUSES = ["requested", "cancelled", "completed"] as const;
const REASON_MIN = 5;
const REASON_MAX = 500;

interface TimelineEvent { at?: string; action?: string; actor?: string | null; note?: string | null }

function UserCell({ value }: { value: unknown }) {
  const { t } = useI18n();
  const user = userBrief(value);
  if (!user) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="block">
      <span className="font-medium">{user.name || t("deletions.account")}</span>
      <Ltr as="span" className="block text-xs text-muted-foreground">{user.email}</Ltr>
    </span>
  );
}

/** Detail drawer: the request, its user and the audited timeline (GET account-deletions/{id}/). */
function DeletionDrawer({ row, onOpenChange }: { row: EntityRecord | null; onOpenChange: (open: boolean) => void }) {
  const { t, tOr, locale } = useI18n();
  const id = row?.id;
  const detail = useQuery({
    queryKey: ["account-deletion", id],
    enabled: id !== undefined && id !== null,
    queryFn: async () => unwrap(await apiFetch<ApiEnvelope<EntityRecord> | EntityRecord>(deletionPath(id!))),
  });
  const data = (detail.data ?? row ?? {}) as EntityRecord;
  const timeline = Array.isArray(data.timeline) ? (data.timeline as TimelineEvent[]) : [];
  const user = userBrief(data.user);
  return (
    <Sheet open={Boolean(row)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t("deletions.detailsTitle", { id: formatNumber(id, locale) })}</SheetTitle>
          <SheetDescription>{user ? <>{user.name} · <Ltr as="span">{user.email}</Ltr></> : null}</SheetDescription>
        </SheetHeader>
        <div className="mt-5 space-y-5">
          <dl className="grid grid-cols-2 gap-2">
            {([
              ["field.status", <StatusPill key="s" value={data.status} />],
              ["field.days_remaining", data.days_remaining === null || data.days_remaining === undefined ? "—" : formatNumber(data.days_remaining, locale)],
              ["field.requested_at", formatDate(data.requested_at, locale)],
              ["field.scheduled_for", formatDate(data.scheduled_for, locale)],
              ["field.cancelled_at", formatDate(data.cancelled_at, locale)],
              ["field.completed_at", formatDate(data.completed_at, locale)],
            ] as const).map(([key, value]) => (
              <div key={key} className="rounded-xl border bg-muted/30 p-3"><dt className="text-[11px] font-bold text-muted-foreground">{t(key)}</dt><dd className="mt-1 text-sm">{value}</dd></div>
            ))}
          </dl>
          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="text-[11px] font-bold text-muted-foreground">{t("deletions.reasonLabel")}</div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{String(data.reason || "—")}</p>
          </div>
          <section aria-label={t("deletions.timeline")}>
            <h3 className="mb-3 text-sm font-black">{t("deletions.timeline")}</h3>
            {detail.isPending ? <Skeleton className="h-24 rounded-xl" /> : detail.isError ? <ErrorPanel error={detail.error} retry={() => void detail.refetch()} /> : timeline.length ? (
              <ol className="space-y-3 border-s ps-4">
                {timeline.map((event, index) => (
                  <li key={`${event.at}-${index}`} className="relative">
                    <span className="absolute -start-[1.3rem] top-1.5 size-2.5 rounded-full bg-primary" aria-hidden="true" />
                    <div className="text-sm font-semibold">{tOr(`deletions.event.${String(event.action)}`, t("common.unknownValue"))}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(event.at, locale)}{event.actor ? ` · ${t("deletions.by", { actor: event.actor })}` : ""}</div>
                    {event.note ? <p className="mt-1 text-xs">{t("deletions.timelineNote", { note: event.note })}</p> : null}
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-muted-foreground">{t("deletions.noTimeline")}</p>}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Irreversible early execution: admin only, a written reason and the account e-mail typed again. */
function ExecuteDialog({ row, onOpenChange }: { row: EntityRecord | null; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");
  const keys = useIdempotencyKey();
  const keyError = useMutationError(keys);
  const user = userBrief(row?.user);
  const reasonOk = reason.trim().length >= REASON_MIN;
  const ready = reasonOk && Boolean(user) && emailMatches(email, user?.email);

  const execute = useMutation({
    mutationFn: () => {
      const body = { reason: reason.trim(), confirm_email: email.trim() };
      return apiFetch(`${deletionPath(row?.id as number)}execute/`, { method: "POST", body, idempotencyKey: keys.get(payloadSignature("deletion-execute", row?.id, body)) });
    },
    onSuccess() {
      keys.reset();
      toast.success(t("deletions.executeDone"));
      void queryClient.invalidateQueries({ queryKey: ["resource", "account-deletions"] });
      void queryClient.invalidateQueries({ queryKey: ["account-deletion"] });
      onOpenChange(false);
    },
    onError: keyError,
  });

  return (
    <Dialog open={Boolean(row)} onOpenChange={(open) => { if (!open && !execute.isPending) onOpenChange(false); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive"><Skull className="size-5" />{t("deletions.executeTitle")}</DialogTitle>
          <DialogDescription>{t("deletions.executeWarning", { name: user?.name ?? "" })}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (ready && !execute.isPending) execute.mutate(); }}>
          <div className="space-y-2">
            <Label htmlFor="deletion-execute-reason">{t("deletions.executeReason")}<span className="ms-1 text-destructive" aria-hidden="true">*</span></Label>
            <Textarea id="deletion-execute-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={REASON_MAX} aria-required />
            {reason && !reasonOk ? <p role="alert" className="text-xs font-medium text-destructive">{t("validation.minLength", { n: REASON_MIN })}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="deletion-execute-email">{t("deletions.executeConfirmLabel")}<span className="ms-1 text-destructive" aria-hidden="true">*</span></Label>
            <Input id="deletion-execute-email" dir="ltr" className="text-start" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} aria-required aria-describedby="deletion-execute-email-hint" />
            <p id="deletion-execute-email-hint" className="text-xs text-muted-foreground">{t("deletions.executeConfirmHint", { email: "" })}<Ltr as="span" className="font-mono">{user?.email}</Ltr></p>
          </div>
          {execute.error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{apiErrorText(execute.error, t)}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={execute.isPending}>{t("common.cancel")}</Button>
            <Button type="submit" variant="destructive" isLoading={execute.isPending} disabled={!ready}>{t("deletions.execute")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Account deletion requests: filterable list, detail drawer with timeline, cancel (reason) and admin-only early execution. */
export function DeletionsPage() {
  const { t, enumLabel } = useI18n();
  const { user } = useSession();
  const canExecute = canExecuteDeletion(user.role);
  const [drawerRow, setDrawerRow] = useState<EntityRecord | null>(null);
  const [executeRow, setExecuteRow] = useState<EntityRecord | null>(null);

  const columns = useMemo<ResourceColumn[]>(() => [
    { key: "id", label: "#" },
    { key: "user", render: (value) => <UserCell value={value} /> },
    { key: "status", render: (value) => <StatusPill value={value} /> },
    { key: "requested_at" },
    { key: "scheduled_for" },
    { key: "days_remaining" },
  ], []);
  const filters = useMemo<ManagerFilter[]>(() => [{ param: "status", label: t("deletions.filter.status"), options: STATUSES.map((value) => ({ value, label: enumLabel(value) })) }], [t, enumLabel]);
  const customRowActions = useMemo<ManagerCustomAction[]>(() => [
    { key: "details", label: t("deletions.details"), icon: <Eye />, onSelect: setDrawerRow },
    ...(canExecute ? [{ key: "execute", label: t("deletions.execute"), icon: <Skull />, visible: isPendingDeletion, onSelect: setExecuteRow } satisfies ManagerCustomAction] : []),
  ], [t, canExecute]);
  const rowActions = useMemo<ManagerRowAction[]>(() => [{
    key: "cancel",
    label: t("deletions.cancel"),
    icon: <UserRoundX />,
    visible: isPendingDeletion,
    confirm: { title: t("deletions.cancelTitle"), description: (row) => t("deletions.cancelBody", { name: userBrief(row.user)?.name ?? "" }), confirmLabel: t("deletions.cancel") },
    reason: { label: t("deletions.cancelReason"), minLength: REASON_MIN, maxLength: REASON_MAX },
    request: (row, reason) => ({ path: `${deletionPath(row.id as number)}cancel/`, method: "POST", body: { reason } }),
  }], [t]);

  return (
    <>
      <ResourceManager
        resourceKey="account-deletions"
        title={t("governance.deletions.title")}
        description={t("governance.deletions.subtitle")}
        eyebrow={t("nav.governance")}
        capability={CAPABILITIES.users}
        columns={columns}
        filters={filters}
        customRowActions={customRowActions}
        rowActions={rowActions}
        onViewRow={setDrawerRow}
      />
      <DeletionDrawer row={drawerRow} onOpenChange={(open) => { if (!open) setDrawerRow(null); }} />
      <ExecuteDialog key={String(executeRow?.id ?? "none")} row={executeRow} onOpenChange={(open) => { if (!open) setExecuteRow(null); }} />
    </>
  );
}

