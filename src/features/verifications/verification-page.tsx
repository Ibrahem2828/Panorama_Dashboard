"use client";

import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Pagination } from "@/components/data-grid/pagination";
import { ResourceTable } from "@/components/data-grid/resource-table";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { RESOURCE_DEFINITIONS } from "@/contracts/generated/resource-definitions";
import { listResource, type EntityRecord } from "@/features/resources/resource-api";
import { useI18n } from "@/i18n/provider";
import { apiFetch, downloadFromBackend, unwrap } from "@/lib/api/browser-client";
import type { ApiEnvelope } from "@/types/api";

export function VerificationPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<EntityRecord | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | "needs-update" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const definition = RESOURCE_DEFINITIONS.verifications;
  const query = useQuery({
    queryKey: ["verifications", page, pageSize, status],
    queryFn: () => listResource(definition, { page, pageSize, ordering: "-created_at", filters: status === "all" ? {} : { status } }),
  });
  const review = useMutation({
    mutationFn: async () => {
      if (!selected?.id || !action) throw new Error("Missing verification request.");
      return apiFetch(`/api/v1/dashboard/verifications/${selected.id}/${action}/`, { method: "POST", body: { rejection_reason: rejectionReason, admin_note: adminNote } });
    },
    onSuccess() { toast.success(t("common.success")); setAction(null); setSelected(null); setRejectionReason(""); setAdminNote(""); void queryClient.invalidateQueries({ queryKey: ["verifications"] }); },
    onError(error: Error) { toast.error(error.message); },
  });
  const card = useMutation({
    mutationFn: async (row: EntityRecord) => {
      const ticket = await unwrap(apiFetch<ApiEnvelope<{ preview_url: string }>>(`/api/v1/dashboard/verifications/${row.id}/card-ticket/`, { method: "POST" }));
      const path = new URL(ticket.preview_url).pathname;
      const downloaded = await downloadFromBackend(path);
      return URL.createObjectURL(await downloaded.blob());
    },
    onSuccess(url) { setPreview((current) => { if (current) URL.revokeObjectURL(current); return url; }); },
    onError(error: Error) { toast.error(error.message); },
  });
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("verifications.title")} description={t("verifications.subtitle")} eyebrow="IDENTITY REVIEW" actions={<Button variant="outline" onClick={() => query.refetch()}><RefreshCw />{t("common.refresh")}</Button>} />
      <Card><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><Label>{t("common.status")}</Label><Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}><SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("common.all")}</SelectItem>{["pending","approved","rejected","needs_update"].map((value)=><SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></CardContent></Card>
      {query.isPending ? <Skeleton className="h-96 rounded-2xl" /> : query.isError ? <ErrorPanel error={query.error} retry={() => query.refetch()} /> : (
        <>
          <ResourceTable
            rows={query.data.results}
            columns={[
              { key: "id", label: "#" }, { key: "user_name" }, { key: "user_email" }, { key: "student_number" },
              { key: "detected_faculty_name" }, { key: "status", render: (value) => <StatusPill value={value} /> }, { key: "created_at" },
            ]}
            onView={(row) => { setSelected(row); setAction(null); }}
            onEdit={() => undefined}
            onDelete={() => undefined}
          />
          <Pagination page={page} pageSize={pageSize} count={query.data.count} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1); }} />
        </>
      )}

      <Dialog open={Boolean(selected && !action)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{selected?.user_name as string}</DialogTitle><DialogDescription>{selected?.student_number as string}</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">{selected ? Object.entries(selected).filter(([key]) => !key.includes("detail")).map(([key,value]) => <div key={key} className="rounded-xl border p-3"><div className="text-xs font-bold text-muted-foreground">{key}</div><div className="mt-1 break-words text-sm">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "â€”")}</div></div>) : null}</div>
          <DialogFooter className="flex-wrap gap-2"><Button variant="outline" onClick={() => selected && card.mutate(selected)} isLoading={card.isPending}><Eye />{t("verifications.cardPreview")}</Button><Button variant="outline" onClick={() => setAction("needs-update")}><RotateCcw />{t("verifications.needsUpdate")}</Button><Button variant="destructive" onClick={() => setAction("reject")}><XCircle />{t("verifications.reject")}</Button><Button onClick={() => setAction("approve")}><CheckCircle2 />{t("verifications.approve")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(action)} onOpenChange={(open) => { if (!open) setAction(null); }}>
        <DialogContent><DialogHeader><DialogTitle>{action === "approve" ? t("verifications.approve") : action === "reject" ? t("verifications.reject") : t("verifications.needsUpdate")}</DialogTitle><DialogDescription>{selected?.user_name as string}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-3"><div className="space-y-2"><Label>{t("verifications.decisionReason")}</Label><Textarea value={rejectionReason} onChange={(e)=>setRejectionReason(e.target.value)} maxLength={2000}/></div><div className="space-y-2"><Label>{t("verifications.adminNote")}</Label><Textarea value={adminNote} onChange={(e)=>setAdminNote(e.target.value)} maxLength={4000}/></div></div>
          <DialogFooter><Button variant="outline" onClick={()=>setAction(null)}>{t("common.cancel")}</Button><Button variant={action === "reject" ? "destructive" : "default"} onClick={()=>review.mutate()} isLoading={review.isPending}>{t("common.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>{t("verifications.cardPreview")}</DialogTitle><DialogDescription>{t("verifications.cardPreviewDescription")}</DialogDescription></DialogHeader>{preview ? <Image src={preview} alt={t("verifications.cardPreviewAlt")} width={1600} height={1000} unoptimized className="max-h-[70vh] w-full rounded-xl object-contain" /> : null}</DialogContent>
      </Dialog>
    </div>
  );
}


