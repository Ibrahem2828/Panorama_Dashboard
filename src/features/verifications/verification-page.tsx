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
import { useIdempotencyKey, useMutationError } from "@/hooks/use-idempotency-key";
import { payloadSignature } from "@/lib/api/idempotency";
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
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [inlineCard, setInlineCard] = useState<string | null>(null);
  const definition = RESOURCE_DEFINITIONS.verifications;
  const query = useQuery({
    queryKey: ["verifications", page, pageSize, status],
    queryFn: () => listResource(definition, { page, pageSize, ordering: "-created_at", filters: status === "all" ? {} : { status } }),
  });
  const reviewKey = useIdempotencyKey();
  const reviewError = useMutationError(reviewKey);
  const review = useMutation({
    mutationFn: async () => {
      if (!selected?.id || !action) throw new Error("Missing verification request.");
      const body = { rejection_reason: rejectionReason.trim(), admin_note: adminNote.trim() };
      return apiFetch(`/api/v1/dashboard/verifications/${selected.id}/${action}/`, { method: "POST", body, idempotencyKey: reviewKey.get(payloadSignature(action, selected.id, body)) });
    },
    onSuccess() { reviewKey.reset(); toast.success(t("common.success")); setAction(null); setSelected(null); setRejectionReason(""); setAdminNote(""); setReasonError(null); void queryClient.invalidateQueries({ queryKey: ["verifications"] }); },
    onError: reviewError,
  });
  const cardError = useMutationError();
  const card = useMutation({
    mutationFn: async (row: EntityRecord) => {
      const ticket = await unwrap(apiFetch<ApiEnvelope<{ preview_url: string }>>(`/api/v1/dashboard/verifications/${row.id}/card-ticket/`, { method: "POST" }));
      const path = new URL(ticket.preview_url).pathname;
      const downloaded = await downloadFromBackend(path);
      return URL.createObjectURL(await downloaded.blob());
    },
    onSuccess(url) { setInlineCard((current) => { if (current) URL.revokeObjectURL(current); return url; }); },
    onError: cardError,
  });
  useEffect(() => () => { if (inlineCard) URL.revokeObjectURL(inlineCard); }, [inlineCard]);


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
            onView={(row) => { setSelected(row); setAction(null); setInlineCard((current) => { if (current) URL.revokeObjectURL(current); return null; }); card.mutate(row); }}
            onEdit={() => undefined}
            onDelete={() => undefined}
          />
          <Pagination page={page} pageSize={pageSize} count={query.data.count} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1); }} />
        </>
      )}

      <Dialog open={Boolean(selected && !action)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{selected?.user_name as string}</DialogTitle><DialogDescription>{selected?.student_number as string}</DialogDescription></DialogHeader>
          {selected ? <VerificationSummary row={selected} cardUrl={inlineCard} cardLoading={card.isPending && !inlineCard} onOpenFull={() => inlineCard && setPreview(inlineCard)} /> : null}
          <DialogFooter className="flex-wrap gap-2"><Button variant="outline" onClick={() => inlineCard && setPreview(inlineCard)} disabled={!inlineCard}><Eye />{t("verifications.cardPreview")}</Button><Button variant="outline" onClick={() => setAction("needs-update")}><RotateCcw />{t("verifications.needsUpdate")}</Button><Button variant="destructive" onClick={() => setAction("reject")}><XCircle />{t("verifications.reject")}</Button><Button onClick={() => setAction("approve")}><CheckCircle2 />{t("verifications.approve")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(action)} onOpenChange={(open) => { if (!open) { setAction(null); setReasonError(null); } }}>
        <DialogContent><DialogHeader><DialogTitle>{action === "approve" ? t("verifications.approve") : action === "reject" ? t("verifications.reject") : t("verifications.needsUpdate")}</DialogTitle><DialogDescription>{selected?.user_name as string}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-3"><div className="space-y-2"><Label htmlFor="verification-reason">{t("verifications.decisionReason")}{action !== "approve" ? <span className="ms-1 text-destructive" aria-hidden="true">*</span> : null}</Label><Textarea id="verification-reason" value={rejectionReason} onChange={(e)=>{ setRejectionReason(e.target.value); setReasonError(null); }} maxLength={2000} aria-required={action !== "approve" || undefined} aria-invalid={reasonError ? true : undefined} aria-describedby={reasonError ? "verification-reason-error" : undefined}/>{reasonError ? <p id="verification-reason-error" role="alert" className="text-xs font-medium text-destructive">{reasonError}</p> : null}</div><div className="space-y-2"><Label>{t("verifications.adminNote")}</Label><Textarea value={adminNote} onChange={(e)=>setAdminNote(e.target.value)} maxLength={4000}/></div></div>
          <DialogFooter><Button variant="outline" onClick={()=>setAction(null)}>{t("common.cancel")}</Button><Button variant={action === "reject" ? "destructive" : "default"} onClick={()=>{ if (action !== "approve" && !rejectionReason.trim()) { setReasonError(t("verifications.reasonRequired")); document.getElementById("verification-reason")?.focus(); return; } review.mutate(); }} isLoading={review.isPending}>{t("common.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>{t("verifications.cardPreview")}</DialogTitle><DialogDescription>{t("verifications.cardPreviewDescription")}</DialogDescription></DialogHeader>{preview ? <Image src={preview} alt={t("verifications.cardPreviewAlt")} width={1600} height={1000} unoptimized className="max-h-[70vh] w-full rounded-xl object-contain" /> : null}</DialogContent>
      </Dialog>
    </div>
  );
}



function VerificationSummary({ row, cardUrl, cardLoading, onOpenFull }: { row: EntityRecord; cardUrl: string | null; cardLoading: boolean; onOpenFull: () => void }) {
  const { t } = useI18n();
  const named = (value: unknown) => (value && typeof value === "object" ? ((value as { name?: string }).name ?? null) : null);
  const text = (value: unknown) => (value === null || value === undefined || value === "" ? "—" : String(value));
  const fields: [string, string][] = [
    [t("verifications.field.name"), text(row.user_name)],
    [t("verifications.field.email"), text(row.user_email)],
    [t("verifications.field.studentNumber"), text(row.student_number)],
    [t("verifications.field.university"), text(named(row.university_detail))],
    [t("verifications.field.faculty"), text(named(row.faculty_detail))],
    [t("verifications.field.detectedFaculty"), text(row.detected_faculty_name)],
    [t("verifications.field.major"), text(named(row.major_detail))],
    [t("verifications.field.academicYear"), text(named(row.academic_year_detail))],
    [t("verifications.field.semester"), text(named(row.semester_detail))],
    [t("verifications.field.status"), text(row.status)],
    [t("verifications.field.submitted"), text(row.created_at)],
  ];
  return (
    <div className="grid gap-4 md:grid-cols-[1.25fr_1fr]">
      <dl className="grid grid-cols-2 content-start gap-2">
        {fields.map(([label, value]) => (
          <div key={label} className="rounded-xl border p-3">
            <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="space-y-2">
        <p className="text-xs font-bold text-muted-foreground">{t("verifications.field.card")}</p>
        <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-xl border bg-muted/40 p-2">
          {cardUrl ? (
            <button type="button" onClick={onOpenFull} className="w-full cursor-zoom-in" aria-label={t("verifications.cardPreview")}>
              <Image src={cardUrl} alt={t("verifications.cardPreviewAlt")} width={1200} height={800} unoptimized className="max-h-80 w-full rounded-lg object-contain" />
            </button>
          ) : cardLoading ? (
            <Skeleton className="h-52 w-full" />
          ) : (
            <p className="text-sm text-muted-foreground">{t("verifications.cardUnavailable")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
