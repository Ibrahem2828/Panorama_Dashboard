"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, RotateCw, Search, XCircle, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useI18n } from "@/i18n/provider";
import { apiFetch, downloadFromBackend, normalizeCollection, unwrap } from "@/lib/api/browser-client";
import { UserLink } from "@/features/users/user-link";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import type { ApiEnvelope } from "@/types/api";

interface Item { id: number; status: string; reason: string; subject: { id: number; name: string; code: string } }
interface EnrollmentRow {
  id: number; user?: number; status: string; items: Item[]; user_name: string; user_email: string; student_number: string;
  faculty_name: string; academic_year_name: string | null; semester_name: string | null; created_at: string; review_note: string;
  screenshot_ticket_endpoint: string;
}

const STATUSES = ["pending", "approved", "partially_approved", "rejected"] as const;
type Pending = { kind: "reject_all" | "approve_selected" | "bulk_reject"; ids?: number[] } | null;

/** Review inbox: pick a request, compare the Learnata screenshot with the student's data, decide in one click. */
export function EnrollmentReviewPage() {
  const { t, enumLabel } = useI18n();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>("pending");
  const [searchDraft, setSearchDraft] = useState("");
  const search = useDebouncedValue(searchDraft);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [bulk, setBulk] = useState<Set<number>>(new Set());
  const [shot, setShot] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");

  const list = useQuery({
    queryKey: ["enrollment-requests", status, search],
    refetchInterval: 20000,
    queryFn: async () => {
      const params = new URLSearchParams({ page_size: "100", ordering: "-created_at" });
      if (status !== "all") params.set("status", status);
      if (search) params.set("search", search);
      return normalizeCollection<EnrollmentRow>(await apiFetch(`/api/v1/dashboard/enrollment/requests/?${params}`));
    },
  });
  const rows = useMemo(() => list.data?.results ?? [], [list.data]);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  // Selecting a request pre-ticks every subject (the common case is "approve all") and resets the viewer.
  const pick = useCallback((row: EnrollmentRow | null) => {
    setSelectedId(row?.id ?? null);
    setChecked(new Set(row?.items.map((item) => item.id) ?? []));
    setZoom(1); setRotation(0); setShot(null);
  }, []);

  const ticketEndpoint = selected?.screenshot_ticket_endpoint;
  useEffect(() => {
    if (!ticketEndpoint) return undefined;
    let cancelled = false; let url: string | null = null;
    void (async () => {
      try {
        const ticket = await unwrap(apiFetch<ApiEnvelope<{ preview_url: string }>>(ticketEndpoint, { method: "POST" }));
        const response = await downloadFromBackend(new URL(ticket.preview_url).pathname);
        url = URL.createObjectURL(await response.blob());
        if (!cancelled) setShot(url); else URL.revokeObjectURL(url);
      } catch { if (!cancelled) toast.error(t("enrollmentReview.shotFailed")); }
    })();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [ticketEndpoint, t]);

  const afterDecision = useCallback(async () => {
    toast.success(t("common.success"));
    setPending(null); setReason(""); setBulk(new Set());
    const index = rows.findIndex((row) => row.id === selectedId);
    const next = status === "pending" ? rows[index + 1] ?? rows[index - 1] : null;
    pick(next && next.id !== selectedId ? next : null);
    await queryClient.invalidateQueries({ queryKey: ["enrollment-requests"] });
    await queryClient.invalidateQueries({ queryKey: ["enrollment-summary"] });
  }, [pick, queryClient, rows, selectedId, status, t]);

  const decide = useMutation({
    mutationFn: async (input: { action: string; reason?: string; itemIds?: number[] }) =>
      apiFetch(`/api/v1/dashboard/enrollment/requests/${selectedId}/decision/`, {
        method: "POST", body: { action: input.action, reason: input.reason, item_ids: input.itemIds },
      }),
    onSuccess: afterDecision,
    onError: () => toast.error(t("enrollmentReview.failed")),
  });
  const bulkDecide = useMutation({
    mutationFn: async (input: { ids: number[]; action: string; reason?: string }) =>
      apiFetch("/api/v1/dashboard/enrollment/requests/bulk-decision/", { method: "POST", body: input }),
    onSuccess: afterDecision,
    onError: () => toast.error(t("enrollmentReview.failed")),
  });

  const open = selected?.status === "pending";
  const approveSelected = () => {
    if (!selected) return;
    if (checked.size === selected.items.length) decide.mutate({ action: "approve_all" });
    else setPending({ kind: "approve_selected" });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!open || pending || (event.target as HTMLElement | null)?.closest("input, textarea")) return;
      if (event.key.toLowerCase() === "a" && checked.size > 0) { event.preventDefault(); approveSelected(); }
      if (event.key.toLowerCase() === "r") { event.preventDefault(); setPending({ kind: "reject_all" }); }
      if (event.key === "ArrowDown" || event.key.toLowerCase() === "j") {
        const index = rows.findIndex((row) => row.id === selectedId);
        const following = rows[index + 1];
        if (following) pick(following);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const confirm = () => {
    if (!pending) return;
    const trimmed = reason.trim();
    if (!trimmed) { toast.error(t("enrollmentReview.reasonRequired")); return; }
    if (pending.kind === "reject_all") decide.mutate({ action: "reject_all", reason: trimmed });
    else if (pending.kind === "approve_selected") decide.mutate({ action: "approve_selected", reason: trimmed, itemIds: [...checked] });
    else bulkDecide.mutate({ ids: [...bulk], action: "reject_all", reason: trimmed });
  };

  const openRows = rows.filter((row) => row.status === "pending");
  const toggleBulk = (id: number) => setBulk((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return (
    <CapabilityGate capability={CAPABILITIES.enrollment}>
      <PageHeader title={t("enrollmentReview.title")} description={t("enrollmentReview.subtitle")} />
      <div className="grid gap-4 lg:grid-cols-[20rem_1fr_22rem]">
        <Card className="flex max-h-[75vh] flex-col gap-2 overflow-hidden p-3">
          <div className="relative">
            <Search className="absolute start-3 top-3 size-4 text-muted-foreground" />
            <Input className="ps-9" placeholder={t("enrollmentReview.search")} value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} />
          </div>
          <div className="flex flex-wrap gap-1">
            {["all", ...STATUSES].map((value) => (
              <Button key={value} size="sm" variant={status === value ? "default" : "outline"} onClick={() => setStatus(value)}>
                {value === "all" ? t("common.all") : enumLabel(value)}
              </Button>
            ))}
          </div>
          {status === "pending" && openRows.length > 0 ? (
            <div className="flex flex-wrap gap-1 border-y py-2">
              <Button size="sm" variant="outline" onClick={() => setBulk(bulk.size === openRows.length ? new Set() : new Set(openRows.map((row) => row.id)))}>
                {t("enrollmentReview.selectAll")}
              </Button>
              <Button size="sm" disabled={bulk.size === 0 || bulkDecide.isPending} onClick={() => bulkDecide.mutate({ ids: [...bulk], action: "approve_all" })}>
                <CheckCheck className="size-4" />{t("enrollmentReview.approveChecked", { count: bulk.size })}
              </Button>
              <Button size="sm" variant="destructive" disabled={bulk.size === 0} onClick={() => setPending({ kind: "bulk_reject" })}>
                <XCircle className="size-4" />{t("enrollmentReview.rejectChecked")}
              </Button>
            </div>
          ) : null}
          <div className="flex-1 space-y-1 overflow-y-auto">
            {list.isLoading ? <Skeleton className="h-24 w-full" /> : null}
            {list.error ? <ErrorPanel error={list.error} retry={() => void list.refetch()} /> : null}
            {!list.isLoading && rows.length === 0 ? <p className="p-3 text-sm text-muted-foreground">{t("enrollmentReview.empty")}</p> : null}
            {rows.map((row) => (
              <div key={row.id} className={`flex items-start gap-2 rounded-md border p-2 ${selectedId === row.id ? "border-primary bg-muted" : "border-transparent hover:bg-muted"}`}>
                {row.status === "pending" && status === "pending" ? (
                  <input type="checkbox" className="mt-1" aria-label={row.user_name} checked={bulk.has(row.id)} onChange={() => toggleBulk(row.id)} />
                ) : null}
                <button type="button" className="min-w-0 flex-1 text-start" onClick={() => pick(row)}>
                  <div className="truncate text-sm font-semibold">{row.user_name}</div>
                  <div className="truncate text-xs text-muted-foreground">{row.student_number} · {row.faculty_name}</div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("enrollmentReview.subjectsCount", { count: row.items.length })}</span>
                    <StatusPill value={row.status} />
                  </div>
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="flex max-h-[75vh] min-h-[24rem] flex-col overflow-hidden">
          {!selected ? <div className="m-auto p-6 text-sm text-muted-foreground">{t("enrollmentReview.pick")}</div> : (
            <>
              <div className="flex items-center justify-between gap-2 border-b p-2">
                <span className="truncate text-sm font-semibold">{selected.user_name}</span>
                <span className="flex gap-1">
                  <Button size="icon" variant="outline" aria-label={t("enrollmentReview.zoomIn")} onClick={() => setZoom((value) => Math.min(4, value + 0.25))}><ZoomIn className="size-4" /></Button>
                  <Button size="icon" variant="outline" aria-label={t("enrollmentReview.zoomOut")} onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}><ZoomOut className="size-4" /></Button>
                  <Button size="icon" variant="outline" aria-label={t("enrollmentReview.rotate")} onClick={() => setRotation((value) => (value + 90) % 360)}><RotateCw className="size-4" /></Button>
                </span>
              </div>
              <div className="flex-1 overflow-auto bg-muted/40 p-2">
                {shot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shot} alt={t("enrollmentReview.shotAlt")} draggable={false} className="mx-auto origin-top transition-transform" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, maxWidth: "100%" }} />
                ) : <Skeleton className="h-full min-h-64 w-full" />}
              </div>
            </>
          )}
        </Card>

        <Card className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto p-4">
          {selected ? (
            <>
              <div className="space-y-1 text-sm">
                <div className="text-base font-semibold"><UserLink userId={selected.user} name={selected.user_name} /></div>
                <div className="text-muted-foreground" dir="ltr">{selected.user_email}</div>
                <div>{t("enrollmentReview.studentNumber")}: <span dir="ltr">{selected.student_number}</span></div>
                <div>{selected.faculty_name}</div>
                <div className="text-muted-foreground">{[selected.academic_year_name, selected.semester_name].filter(Boolean).join(" - ")}</div>
              </div>
              <div className="space-y-1 border-t pt-3">
                <div className="text-sm font-semibold">{t("enrollmentReview.requestedSubjects")}</div>
                {selected.items.map((item) => (
                  <label key={item.id} className="flex items-start gap-2 text-sm">
                    {open ? (
                      <input type="checkbox" className="mt-1" checked={checked.has(item.id)} onChange={() => setChecked((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} />
                    ) : null}
                    <span className="flex-1">
                      {item.subject.name} <span className="text-xs text-muted-foreground" dir="ltr">{item.subject.code}</span>
                      {!open ? <span className="ms-2 text-xs"><StatusPill value={item.status} /></span> : null}
                      {item.reason ? <span className="block text-xs text-muted-foreground">{item.reason}</span> : null}
                    </span>
                  </label>
                ))}
              </div>
              {open ? (
                <div className="mt-auto space-y-2 border-t pt-3">
                  <Button className="w-full" disabled={decide.isPending} onClick={() => decide.mutate({ action: "approve_all" })}>
                    <CheckCheck className="size-4" />{t("enrollmentReview.approveAll")} <kbd className="ms-2 rounded border px-1 text-xs">A</kbd>
                  </Button>
                  <Button className="w-full" variant="outline" disabled={decide.isPending || checked.size === 0} onClick={approveSelected}>
                    {t("enrollmentReview.approveSelected", { count: checked.size })}
                  </Button>
                  <Button className="w-full" variant="destructive" disabled={decide.isPending} onClick={() => setPending({ kind: "reject_all" })}>
                    <XCircle className="size-4" />{t("enrollmentReview.rejectAll")} <kbd className="ms-2 rounded border px-1 text-xs">R</kbd>
                  </Button>
                </div>
              ) : selected.review_note ? <p className="text-sm text-muted-foreground">{selected.review_note}</p> : null}
            </>
          ) : <p className="text-sm text-muted-foreground">{t("enrollmentReview.pick")}</p>}
        </Card>
      </div>

      <Dialog open={pending !== null} onOpenChange={(openState) => { if (!openState) { setPending(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("enrollmentReview.reasonTitle")}</DialogTitle>
            <DialogDescription>{t("enrollmentReview.reasonBody")}</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} maxLength={500} autoFocus onChange={(event) => setReason(event.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPending(null); setReason(""); }}>{t("common.cancel")}</Button>
            <Button variant="destructive" disabled={decide.isPending || bulkDecide.isPending} onClick={confirm}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CapabilityGate>
  );
}
