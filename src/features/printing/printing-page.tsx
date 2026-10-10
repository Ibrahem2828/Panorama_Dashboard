"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, MessageSquarePlus, RefreshCw, Search, UserRoundCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { Pagination } from "@/components/data-grid/pagination";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/status-pill";
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
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useI18n } from "@/i18n/provider";

interface PrintOrder {
  id: number;
  user_name: string;
  status: string;
  priority: string;
  total_price: string;
  currency: string;
  assigned_to?: number | null;
  assigned_to_name?: string;
  user_notes?: string;
  internal_notes?: string;
  created_at: string;
  items?: unknown[];
  status_history?: unknown[];
}

interface StaffUser { id: number; full_name: string; role: string; is_active: boolean }
const statuses = ["submitted", "under_review", "accepted", "printing", "ready", "delivered", "cancelled", "rejected"];

function PrintOrdersPanel() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "all";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("page_size") ?? 25)));
  const [searchDraft, setSearchDraft] = useState(search);
  const debouncedSearch = useDebouncedValue(searchDraft);
  const [selected, setSelected] = useState<PrintOrder | null>(null);
  const [action, setAction] = useState<"status" | "assign" | "note" | null>(null);
  const [nextStatus, setNextStatus] = useState("under_review");
  const [assignedTo, setAssignedTo] = useState("");
  const [publicNote, setPublicNote] = useState("");
  const [internalNote, setInternalNote] = useState("");

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
    queryKey: ["printing-orders", page, pageSize, search, status],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize), ordering: "-created_at" });
      if (search) params.set("search", search);
      if (status !== "all") params.set("status", status);
      return normalizeCollection<PrintOrder>(await apiFetch(`/api/v1/dashboard/printing/orders/?${params}`));
    },
  });
  const staff = useQuery({
    queryKey: ["printing-staff"],
    queryFn: async () => normalizeCollection<StaffUser>(await apiFetch("/api/v1/dashboard/users/?page_size=200&is_active=true")),
  });

  const mutate = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Missing order");
      if (action === "status") return apiFetch(`/api/v1/dashboard/printing/orders/${selected.id}/status/`, { method: "PATCH", body: { status: nextStatus, public_note: publicNote, internal_note: internalNote, rejected_reason: nextStatus === "rejected" ? publicNote : "" } });
      if (action === "assign") return apiFetch(`/api/v1/dashboard/printing/orders/${selected.id}/assign/`, { method: "PATCH", body: { assigned_to: Number(assignedTo) } });
      if (action === "note") return apiFetch(`/api/v1/dashboard/printing/orders/${selected.id}/note/`, { method: "POST", body: { internal_notes: internalNote } });
      throw new Error("Missing action");
    },
    onSuccess() {
      toast.success(t("common.success"));
      setAction(null); setPublicNote(""); setInternalNote("");
      void queryClient.invalidateQueries({ queryKey: ["printing-orders"] });
    },
    onError(error: Error) { toast.error(error.message); },
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardDescription>{t("printing.orders")}</CardDescription><CardTitle>{query.data?.count ?? 0}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>{t("printing.ordersOnPage")}</CardDescription><CardTitle>{query.data?.results.length ?? 0}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>{t("common.status")}</CardDescription><CardTitle>{status === "all" ? t("common.all") : status}</CardTitle></CardHeader></Card>
      </div>
      <div className="glass-panel flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="ps-10" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={t("common.searchPlaceholder")} /></div>
        <Select value={status} onValueChange={(value) => updateUrl({ status: value === "all" ? null : value, page: 1 })}><SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("common.all")}</SelectItem>{statuses.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" onClick={() => query.refetch()}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />{t("common.refresh")}</Button>
      </div>
      {query.isPending ? <Skeleton className="h-96 rounded-2xl" /> : query.isError ? <ErrorPanel error={query.error} retry={() => query.refetch()} /> : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/60 text-start text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-start">#</th><th className="p-3 text-start">{t("users.fullName")}</th><th className="p-3 text-start">{t("common.status")}</th><th className="p-3 text-start">{t("printing.priority")}</th><th className="p-3 text-start">{t("printing.value")}</th><th className="p-3 text-start">{t("support.assign")}</th><th className="p-3 text-start">{t("common.actions")}</th></tr></thead><tbody>
            {query.data.results.map((order) => <tr key={order.id} className="border-t hover:bg-muted/30"><td className="p-3 font-mono">{order.id}</td><td className="p-3 font-semibold">{order.user_name}</td><td className="p-3"><StatusPill value={order.status} /></td><td className="p-3">{order.priority}</td><td className="p-3 font-mono">{order.total_price} {order.currency}</td><td className="p-3">{order.assigned_to_name || "—"}</td><td className="p-3"><Button size="sm" variant="outline" onClick={() => setSelected(order)}><ClipboardList />{t("common.details")}</Button></td></tr>)}
          </tbody></table></div>
          {!query.data.results.length ? <div className="p-10 text-center text-muted-foreground">{t("common.noData")}</div> : null}
        </div>
      )}
      {query.data ? <Pagination page={page} pageSize={pageSize} count={query.data.count} onPage={(next) => updateUrl({ page: next })} onPageSize={(next) => updateUrl({ page_size: next, page: 1 })} /> : null}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) { setSelected(null); setAction(null); } }}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>{t("printing.orderDetails")} #{selected?.id}</DialogTitle><DialogDescription>{selected?.user_name}</DialogDescription></DialogHeader>
          {selected ? <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[[t("common.status"), selected.status], [t("printing.priority"), selected.priority], [t("printing.value"), `${selected.total_price} ${selected.currency}`], [t("support.assign"), selected.assigned_to_name || "—"]].map(([label, value]) => <div key={label} className="rounded-xl border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-bold">{value}</p></div>)}</div>
            <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">{t("printing.userNotes")}</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{selected.user_notes || "—"}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">{t("printing.internalNotes")}</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{selected.internal_notes || "—"}</CardContent></Card></div>
            <div className="flex flex-wrap gap-2"><Button onClick={() => setAction("status")}><RefreshCw />{t("printing.changeStatus")}</Button><Button variant="outline" onClick={() => setAction("assign")}><UserRoundCheck />{t("support.assign")}</Button><Button variant="outline" onClick={() => setAction("note")}><MessageSquarePlus />{t("printing.addNote")}</Button></div>
            {action ? <Card className="border-primary/30"><CardHeader><CardTitle className="text-base">{action === "status" ? t("printing.changeStatus") : action === "assign" ? t("support.assign") : t("printing.addNote")}</CardTitle></CardHeader><CardContent className="space-y-4">
              {action === "status" ? <><div className="space-y-2"><Label>{t("common.status")}</Label><Select value={nextStatus} onValueChange={setNextStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>{t("printing.publicNote")}</Label><Textarea value={publicNote} onChange={(event) => setPublicNote(event.target.value)} /></div><div className="space-y-2"><Label>{t("printing.internalNotes")}</Label><Textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} /></div></> : null}
              {action === "assign" ? <div className="space-y-2"><Label>{t("support.assign")}</Label><Select value={assignedTo} onValueChange={setAssignedTo}><SelectTrigger><SelectValue placeholder={t("support.selectAgent")} /></SelectTrigger><SelectContent>{staff.data?.results.filter((user) => ["print_staff", "admin", "it_support"].includes(user.role)).map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.full_name}</SelectItem>)}</SelectContent></Select></div> : null}
              {action === "note" ? <div className="space-y-2"><Label>{t("printing.internalNotes")}</Label><Textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} /></div> : null}
              <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setAction(null)}>{t("common.cancel")}</Button>{action === "status" ? <ConfirmDialog trigger={<Button disabled={mutate.isPending}>{t("common.save")}</Button>} title={t("printing.confirmStatusTitle")} description={t("printing.confirmStatusDescription", { status: nextStatus })} confirmLabel={t("common.save")} cancelLabel={t("common.cancel")} onConfirm={() => mutate.mutate()} /> : <Button onClick={() => mutate.mutate()} disabled={mutate.isPending || (action === "assign" && !assignedTo)}>{t("common.save")}</Button>}</div>
            </CardContent></Card> : null}
          </div> : null}
          <DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>{t("common.close")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PrintingPage() {
  const { t } = useI18n();
  return (
    <CapabilityGate capability={CAPABILITIES.printing}>
      <div className="space-y-6">
        <PageHeader title={t("printing.title")} description={t("printing.subtitle")} eyebrow="Operations" />
        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="orders">{t("printing.orders")}</TabsTrigger><TabsTrigger value="pricing">{t("printing.pricing")}</TabsTrigger><TabsTrigger value="binding">{t("printing.binding")}</TabsTrigger><TabsTrigger value="locations">{t("printing.locations")}</TabsTrigger></TabsList>
          <TabsContent value="orders"><PrintOrdersPanel /></TabsContent>
          <TabsContent value="pricing"><ResourceManager resourceKey="printing-pricing-rules" title={t("printing.pricing")} capability={CAPABILITIES.printing} /></TabsContent>
          <TabsContent value="binding"><ResourceManager resourceKey="printing-binding-prices" title={t("printing.binding")} capability={CAPABILITIES.printing} /></TabsContent>
          <TabsContent value="locations"><ResourceManager resourceKey="printing-pickup-locations" title={t("printing.locations")} capability={CAPABILITIES.printing} /></TabsContent>
        </Tabs>
      </div>
    </CapabilityGate>
  );
}
