"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircleMore, RefreshCw, Search, Send, UserRoundCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { Pagination } from "@/components/data-grid/pagination";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { apiFetch, normalizeCollection, unwrap } from "@/lib/api/browser-client";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useI18n } from "@/i18n/provider";
import type { ApiEnvelope } from "@/types/api";

interface SupportMessage { id: number; sender_name: string; message: string; has_attachment: boolean; created_at: string }
interface SupportTicket {
  id: number; user_name: string; category: string; subject: string; status: string; priority: string;
  assigned_to?: number | null; assigned_to_name?: string; closed_at?: string | null; last_response_at?: string | null;
  messages?: SupportMessage[]; created_at: string; updated_at: string;
}
interface StaffUser { id: number; full_name: string; role: string; is_active: boolean }
const statuses = ["open", "in_progress", "waiting_user", "resolved", "closed"];
const priorities = ["low", "normal", "high", "urgent"];

export function SupportPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "all";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("page_size") ?? 25)));
  const [searchDraft, setSearchDraft] = useState(search);
  const debouncedSearch = useDebouncedValue(searchDraft);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [message, setMessage] = useState("");
  const [nextStatus, setNextStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  const updateUrl = useCallback((changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, String(value));
    }
    router.replace(`?${next.toString()}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    if (debouncedSearch !== search) updateUrl({ search: debouncedSearch, page: 1 });
  }, [debouncedSearch, search, updateUrl]);

  const query = useQuery({
    queryKey: ["support-tickets", page, pageSize, search, status],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize), ordering: "-updated_at" });
      if (search) params.set("search", search);
      if (status !== "all") params.set("status", status);
      return normalizeCollection<SupportTicket>(await apiFetch(`/api/v1/dashboard/support/tickets/?${params}`));
    },
  });
  const staff = useQuery({
    queryKey: ["support-staff"],
    queryFn: async () => normalizeCollection<StaffUser>(await apiFetch("/api/v1/dashboard/users/?page_size=200&is_active=true")),
  });

  const refreshSelected = async (id: number) => {
    const data = await unwrap(apiFetch<SupportTicket | ApiEnvelope<SupportTicket>>(`/api/v1/dashboard/support/tickets/${id}/`));
    setSelected(data);
  };

  const action = useMutation({
    mutationFn: async (kind: "message" | "status" | "priority" | "assign") => {
      if (!selected) throw new Error("Missing ticket");
      if (kind === "message") return apiFetch(`/api/v1/dashboard/support/tickets/${selected.id}/messages/`, { method: "POST", body: { message } });
      if (kind === "status") return apiFetch(`/api/v1/dashboard/support/tickets/${selected.id}/status/`, { method: "PATCH", body: { status: nextStatus } });
      if (kind === "priority") return apiFetch(`/api/v1/dashboard/support/tickets/${selected.id}/priority/`, { method: "PATCH", body: { priority } });
      return apiFetch(`/api/v1/dashboard/support/tickets/${selected.id}/assign/`, { method: "POST", body: { assigned_to: assignedTo && assignedTo !== "unassigned" ? Number(assignedTo) : null } });
    },
    onSuccess: async () => {
      toast.success(t("common.success"));
      setMessage("");
      if (selected) await refreshSelected(selected.id);
      await queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError(error: Error) { toast.error(error.message); },
  });

  return (
    <CapabilityGate capability={CAPABILITIES.support}>
      <div className="space-y-6">
        <PageHeader title={t("support.title")} description={t("support.subtitle")} eyebrow={t("support.title")} actions={<Button variant="outline" onClick={() => query.refetch()}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />{t("common.refresh")}</Button>} />
        <div className="glass-panel flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="ps-10" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={t("common.searchPlaceholder")} /></div>
          <Select value={status} onValueChange={(value) => updateUrl({ status: value === "all" ? null : value, page: 1 })}><SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("common.all")}</SelectItem>{statuses.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
        </div>
        {query.isPending ? <Skeleton className="h-96 rounded-2xl" /> : query.isError ? <ErrorPanel error={query.error} retry={() => query.refetch()} /> : (
          <div className="overflow-hidden rounded-2xl border bg-card"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/60 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-start">#</th><th className="p-3 text-start">{t("support.subject")}</th><th className="p-3 text-start">{t("users.fullName")}</th><th className="p-3 text-start">{t("common.status")}</th><th className="p-3 text-start">{t("support.priority")}</th><th className="p-3 text-start">{t("support.assign")}</th><th className="p-3 text-start">{t("common.actions")}</th></tr></thead><tbody>
            {query.data.results.map((ticket) => <tr key={ticket.id} className="border-t hover:bg-muted/30"><td className="p-3 font-mono">{ticket.id}</td><td className="p-3"><p className="font-semibold">{ticket.subject}</p><p className="text-xs text-muted-foreground">{ticket.category}</p></td><td className="p-3">{ticket.user_name}</td><td className="p-3"><StatusPill value={ticket.status} /></td><td className="p-3"><StatusPill value={ticket.priority} /></td><td className="p-3">{ticket.assigned_to_name || "â€”"}</td><td className="p-3"><Button size="sm" variant="outline" onClick={async () => { setSelected(ticket); await refreshSelected(ticket.id); }}><MessageCircleMore />{t("common.details")}</Button></td></tr>)}
          </tbody></table></div>{!query.data.results.length ? <div className="p-10 text-center text-muted-foreground">{t("common.noData")}</div> : null}</div>
        )}
        {query.data ? <Pagination page={page} pageSize={pageSize} count={query.data.count} onPage={(next) => updateUrl({ page: next })} onPageSize={(next) => updateUrl({ page_size: next, page: 1 })} /> : null}

        <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
          <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
            <DialogHeader><DialogTitle>{selected?.subject}</DialogTitle><DialogDescription>#{selected?.id} · {selected?.user_name}</DialogDescription></DialogHeader>
            {selected ? <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
              <div className="space-y-3">
                <h3 className="font-bold">{t("support.conversation")}</h3>
                <div className="max-h-[45vh] space-y-3 overflow-y-auto rounded-2xl border bg-muted/20 p-3">
                  {selected.messages?.map((item) => <div key={item.id} className="rounded-xl border bg-background p-3"><div className="flex items-center justify-between gap-3"><strong className="text-sm">{item.sender_name}</strong><span className="text-[11px] text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.message}</p></div>)}
                  {!selected.messages?.length ? <p className="py-8 text-center text-muted-foreground">{t("common.noData")}</p> : null}
                </div>
                <div className="space-y-2"><Label>{t("support.sendMessage")}</Label><Textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={5000} /><Button onClick={() => action.mutate("message")} disabled={!message.trim() || action.isPending}><Send />{t("support.sendMessage")}</Button></div>
              </div>
              <div className="space-y-4">
                <Card><CardHeader><CardTitle className="text-base">{t("support.ticketControls")}</CardTitle></CardHeader><CardContent className="space-y-4">
                  <div className="space-y-2"><Label>{t("common.status")}</Label><div className="flex gap-2"><Select value={nextStatus || selected.status} onValueChange={setNextStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Button size="icon" onClick={() => action.mutate("status")} disabled={action.isPending}><RefreshCw /></Button></div></div>
                  <div className="space-y-2"><Label>{t("support.priority")}</Label><div className="flex gap-2"><Select value={priority || selected.priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{priorities.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Button size="icon" onClick={() => action.mutate("priority")} disabled={action.isPending}><RefreshCw /></Button></div></div>
                  <div className="space-y-2"><Label>{t("support.assign")}</Label><div className="flex gap-2"><Select value={assignedTo || (selected.assigned_to ? String(selected.assigned_to) : "unassigned")} onValueChange={setAssignedTo}><SelectTrigger><SelectValue placeholder={t("support.selectAgent")} /></SelectTrigger><SelectContent><SelectItem value="unassigned">{t("support.unassigned")}</SelectItem>{staff.data?.results.filter((user) => ["support_staff", "admin", "it_support"].includes(user.role)).map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.full_name}</SelectItem>)}</SelectContent></Select><Button size="icon" onClick={() => action.mutate("assign")} disabled={action.isPending}><UserRoundCheck /></Button></div></div>
                </CardContent></Card>
                <Card><CardHeader><CardTitle className="text-base">{t("common.details")}</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p>{t("support.category")}: {selected.category}</p><p>{t("common.createdAt")}: {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(selected.created_at))}</p><p>{t("common.updatedAt")}: {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(selected.updated_at))}</p></CardContent></Card>
              </div>
            </div> : null}
            <DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>{t("common.close")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </CapabilityGate>
  );
}

