"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Check, ExternalLink, RefreshCw, Search, ShieldOff, UserMinus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Pagination } from "@/components/data-grid/pagination";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { StatusPill } from "@/components/shared/status-pill";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  availableMembershipActions, CONFIRMED_ACTIONS, MEMBERSHIP_ROLES, MEMBERSHIP_STATUSES, membershipRequest, membersListPath,
  type MembershipAction,
} from "@/features/groups/group-rules";
import { joinRequestsHref } from "@/features/groups/join-requests-rules";
import { useCan } from "@/features/session";
import { UserLink } from "@/features/users/user-link";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useIdempotencyKey, useMutationError } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import { localizePath } from "@/i18n/routing";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";
import { payloadSignature } from "@/lib/api/idempotency";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { formatDate } from "@/lib/utils";

export interface MembershipRow {
  id: number;
  user: number;
  user_name: string;
  role: string;
  status: string;
  joined_at: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface PendingChange { action: MembershipAction; row: MembershipRow; role?: string }

const PAGE_SIZE = 10;

/**
 * Members of one group with moderation actions (all of them go through the BFF to the dashboard membership endpoints).
 * Join requests have their own screen: the "requests" tab only points there, filtered to this group.
 */
export function GroupMembersDialog({ group, onOpenChange }: { group: { id: number; name: string } | null; onOpenChange: (open: boolean) => void }) {
  const { t, locale, tOr } = useI18n();
  const queryClient = useQueryClient();
  const canManage = useCan(CAPABILITIES.groups);
  const [tab, setTab] = useState<"requests" | "members">("members");
  const [status, setStatus] = useState("approved");
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const search = useDebouncedValue(searchDraft);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const groupId = group?.id;

  const query = useQuery({
    queryKey: ["group-members", groupId, tab, status, search, page],
    enabled: groupId !== undefined && canManage && tab === "members",
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE), ordering: "-created_at" });
      if (search) params.set("search", search);
      if (tab === "members" && status !== "all") params.set("status", status);
      return normalizeCollection<MembershipRow>(await apiFetch(`${membersListPath(groupId ?? 0, tab)}?${params}`));
    },
  });

  const key = useIdempotencyKey();
  const onError = useMutationError(key);
  const mutation = useMutation({
    mutationFn: ({ action, row, role }: PendingChange) => {
      const request = membershipRequest(action, row.id, role);
      return apiFetch(request.path, { method: request.method, body: request.body, idempotencyKey: key.get(payloadSignature(action, row.id, role)) });
    },
    onSuccess() {
      key.reset();
      toast.success(t("common.success"));
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
      void queryClient.invalidateQueries({ queryKey: ["resource", "groups"] });
    },
    onError(error) {
      onError(error);
      setPending(null);
    },
  });

  const run = (change: PendingChange) => {
    if (mutation.isPending) return;
    if (CONFIRMED_ACTIONS.includes(change.action)) setPending(change);
    else mutation.mutate(change);
  };

  const rows = query.data?.results ?? [];
  const name = pending?.row.user_name ?? "";
  const confirmKey = pending ? (pending.action === "role" ? "role" : pending.action) : "reject";
  const confirmCopy = {
    title: t(`groups.confirm.${confirmKey}Title` as "groups.confirm.rejectTitle"),
    description: t(`groups.confirm.${confirmKey}Description` as "groups.confirm.rejectDescription", { name, group: group?.name ?? "", role: pending?.role ? tOr(`enum.${pending.role}`, pending.role) : "" }),
  };

  return (
    <Dialog open={Boolean(group)} onOpenChange={(open) => { if (!mutation.isPending) onOpenChange(open); }}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("groups.members.title", { name: group?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("groups.members.subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Tabs value={tab} onValueChange={(next) => { setTab(next as "requests" | "members"); setPage(1); }}>
            <TabsList>
              <TabsTrigger value="requests">{t("groups.members.tabRequests")}</TabsTrigger>
              <TabsTrigger value="members">{t("groups.members.tabMembers")}</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === "members" ? <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchDraft} onChange={(event) => { setSearchDraft(event.target.value); setPage(1); }} placeholder={t("groups.members.searchPlaceholder")} aria-label={t("common.search")} className="ps-10" />
          </div> : <div className="flex-1" />}
          {tab === "members" ? (
            <Select value={status} onValueChange={(next) => { setStatus(next); setPage(1); }}>
              <SelectTrigger className="sm:w-48" aria-label={t("common.status")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                {MEMBERSHIP_STATUSES.map((value) => <SelectItem key={value} value={value}>{tOr(`groups.status.${value}`, value)}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : null}
          {tab === "members" ? <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching} aria-label={t("common.refresh")}><RefreshCw className={query.isFetching ? "animate-spin" : ""} /></Button> : null}
        </div>

        {tab === "requests" ? (
          <div data-testid="requests-pointer" className="flex flex-col gap-3 rounded-xl border border-dashed p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-7">{t("groups.members.requestsMoved")}</p>
            {group ? (
              <Button asChild variant="outline" className="shrink-0">
                <Link href={localizePath(locale, joinRequestsHref(group.id))}>{t("groups.members.requestsLink")}<ExternalLink className="directional-icon" aria-hidden /></Link>
              </Button>
            ) : null}
          </div>
        ) : query.isPending ? <Skeleton className="h-56 rounded-xl" /> : query.isError ? <ErrorPanel error={query.error} retry={() => query.refetch()} /> : (
          <>
            <div className="overflow-x-auto rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/55">
                    <TableHead>{t("groups.members.user")}</TableHead>
                    <TableHead>{t("groups.members.role")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("groups.members.requestedAt")}</TableHead>
                    <TableHead><span className="sr-only">{t("common.actions")}</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const actions = canManage ? availableMembershipActions(row.status) : [];
                    return (
                      <TableRow key={row.id} data-testid={`membership-${row.id}`}>
                        <TableCell className="font-medium"><UserLink userId={row.user} name={row.user_name} /></TableCell>
                        <TableCell>
                          {actions.includes("role") ? (
                            <Select value={row.role} onValueChange={(next) => { if (next !== row.role) run({ action: "role", row, role: next }); }} disabled={mutation.isPending}>
                              <SelectTrigger className="h-9 w-40" aria-label={t("groups.action.changeRole")}><SelectValue /></SelectTrigger>
                              <SelectContent>{MEMBERSHIP_ROLES.map((value) => <SelectItem key={value} value={value}>{tOr(`enum.${value}`, value)}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : <span>{tOr(`enum.${row.role}`, row.role)}</span>}
                        </TableCell>
                        <TableCell><StatusPill value={row.status} label={tOr(`groups.status.${row.status}`, row.status)} /></TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(row.created_at, locale)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-2">
                            {actions.includes("approve") ? <Button size="sm" onClick={() => run({ action: "approve", row })} disabled={mutation.isPending}><Check />{t("groups.action.approve")}</Button> : null}
                            {actions.includes("reject") ? <Button size="sm" variant="outline" onClick={() => run({ action: "reject", row })} disabled={mutation.isPending}><X />{t("groups.action.reject")}</Button> : null}
                            {actions.includes("remove") ? <Button size="sm" variant="outline" onClick={() => run({ action: "remove", row })} disabled={mutation.isPending}><UserMinus />{t("groups.action.remove")}</Button> : null}
                            {actions.includes("block") ? <Button size="sm" variant="destructive" onClick={() => run({ action: "block", row })} disabled={mutation.isPending}><Ban />{t("groups.action.block")}</Button> : null}
                            {actions.includes("unblock") ? <Button size="sm" variant="outline" onClick={() => run({ action: "unblock", row })} disabled={mutation.isPending}><ShieldOff />{t("groups.action.unblock")}</Button> : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!rows.length ? <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">{t("groups.members.empty")}</TableCell></TableRow> : null}
                </TableBody>
              </Table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} count={query.data.count} onPage={setPage} onPageSize={() => undefined} />
          </>
        )}

        <AlertDialog open={Boolean(pending)} onOpenChange={(open) => { if (!open && !mutation.isPending) setPending(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmCopy.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmCopy.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={mutation.isPending}>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                disabled={mutation.isPending}
                className={pending?.action === "block" || pending?.action === "remove" ? "bg-destructive text-destructive-foreground" : undefined}
                onClick={(event) => { event.preventDefault(); if (pending) mutation.mutate(pending); }}
              >
                {t("form.confirmAction")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
