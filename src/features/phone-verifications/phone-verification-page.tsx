"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Copy, KeyRound, MessageCircle, RefreshCw, Search, Send, Timer, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Pagination } from "@/components/data-grid/pagination";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Ltr } from "@/components/shared/ltr";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { UserLink } from "@/features/users/user-link";
import {
  availableActions, buildWhatsappMessage, claimIsReissue, CODE_VALIDITY_MINUTES, countdownFor, displayPhone, isSixDigitCode,
  normalizeReason, phoneErrorKey, PHONE_VERIFICATION_STATUSES, REJECT_REASON_MAX, statusLabelKey, statusTone, whatsappChatUrl,
  type PhoneVerificationRow,
} from "@/features/phone-verifications/phone-verification-rules";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection, unwrap } from "@/lib/api/browser-client";
import { apiErrorText } from "@/lib/api/error-message";
import { AppApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/utils";
import type { ApiEnvelope } from "@/types/api";

const BASE = "/api/v1/dashboard/phone-verifications";
const POLL_MS = 15_000;

/** The code of one claim. Lives only in the state of this page: never stored, never logged, cleared on close. */
interface IssuedCode { row: PhoneVerificationRow; code: string }

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

async function copyText(text: string, ok: string, failed: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(ok);
  } catch {
    toast.error(failed);
  }
}

export function PhoneVerificationPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("open");
  const [searchDraft, setSearchDraft] = useState("");
  const search = useDebouncedValue(searchDraft);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [issued, setIssued] = useState<IssuedCode | null>(null);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<PhoneVerificationRow | null>(null);

  const query = useQuery({
    queryKey: ["phone-verifications", status, search, page, pageSize],
    refetchInterval: () => (typeof document !== "undefined" && document.hidden ? false : POLL_MS),
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (status !== "all" && status !== "open") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      const result = await normalizeCollection<PhoneVerificationRow>(await apiFetch(`${BASE}/?${params}`));
      // "open" is a UI shortcut: the API filters by one status, so the two open statuses are kept here.
      if (status !== "open") return result;
      const open = result.results.filter((row) => row.status === "pending_staff" || row.status === "code_sent");
      return { ...result, results: open, count: open.length };
    },
  });
  const rows = query.data?.results ?? [];
  const now = useNow(rows.some((row) => row.status === "code_sent"));

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["phone-verifications"] });

  const claim = async (row: PhoneVerificationRow) => {
    setClaimingId(row.id);
    try {
      const data = await unwrap(apiFetch<ApiEnvelope<PhoneVerificationRow & { code?: string }>>(`${BASE}/${row.id}/claim/`, { method: "POST" }));
      const { code, ...claimed } = data;
      if (!isSixDigitCode(code)) throw new Error("The backend did not return a usable code.");
      setIssued({ row: claimed, code });
      refresh();
    } catch (error) {
      const key = error instanceof AppApiError ? phoneErrorKey(error.code) : null;
      toast.error(key ? t(key) : apiErrorText(error, t));
      refresh();
    } finally {
      setClaimingId(null);
    }
  };

  const statuses = [{ value: "open", label: t("phoneVerify.filter.open") }, { value: "all", label: t("common.all") }, ...PHONE_VERIFICATION_STATUSES.map((value) => ({ value, label: t(statusLabelKey(value)) }))];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("phoneVerify.title")}
        description={t("phoneVerify.subtitle")}
        eyebrow={t("eyebrow.identityReview")}
        actions={<Button variant="outline" onClick={() => void query.refetch()}><RefreshCw />{t("common.refresh")}</Button>}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <Label htmlFor="phone-verify-search" className="sr-only">{t("common.search")}</Label>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="phone-verify-search" className="ps-9" value={searchDraft} placeholder={t("phoneVerify.searchPlaceholder")} onChange={(event) => { setSearchDraft(event.target.value); setPage(1); }} />
        </div>
        <div className="sm:w-56">
          <Label htmlFor="phone-verify-status" className="sr-only">{t("common.status")}</Label>
          <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
            <SelectTrigger id="phone-verify-status" aria-label={t("common.status")}><SelectValue /></SelectTrigger>
            <SelectContent>{statuses.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {query.isPending ? (
        <div className="space-y-3" aria-busy="true"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /></div>
      ) : query.isError ? (
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">{t("phoneVerify.empty")}</Card>
      ) : (
        <>
          <ul className="space-y-3" aria-label={t("phoneVerify.title")}>
            {rows.map((row) => (
              <li key={row.id}>
                <RequestCard row={row} now={now} busy={claimingId === row.id} onClaim={() => void claim(row)} onReject={() => setRejecting(row)} />
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={pageSize} count={query.data?.count ?? rows.length} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1); }} />
        </>
      )}

      <CodeDialog issued={issued} onClose={() => setIssued(null)} onSent={() => { setIssued(null); refresh(); }} />
      <RejectDialog key={rejecting?.id ?? 0} row={rejecting} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); refresh(); }} />
    </div>
  );

}

function RequestCard({ row, now: current, busy, onClaim, onReject }: { row: PhoneVerificationRow; now: number; busy: boolean; onClaim: () => void; onReject: () => void }) {
  const { t, locale } = useI18n();
  const actions = availableActions(row);
  const phone = displayPhone(row.phone_number) || row.phone_number;
  const wa = whatsappChatUrl(row.phone_number);
  const countdown = countdownFor(row, current);
  return (
    <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <UserLink userId={row.user_id} name={row.user_name} className="font-bold" />
          <StatusPill value={statusTone(row.status)} label={t(statusLabelKey(row.status))} />
          {countdown.kind === "running" ? (
            <span className={`inline-flex items-center gap-1 text-sm font-semibold tabular-nums ${countdown.low ? "text-destructive" : "text-muted-foreground"}`} aria-label={t("phoneVerify.countdownLabel", { time: countdown.text })}>
              <Timer className="size-4" aria-hidden /><Ltr as="span">{countdown.text}</Ltr>
            </span>
          ) : countdown.kind === "expired" ? <span className="text-sm font-semibold text-destructive">{t("phoneVerify.expiredNow")}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Ltr as="span" className="font-mono font-medium">{phone}</Ltr>
          <Button type="button" variant="ghost" size="sm" aria-label={t("phoneVerify.copyPhone")} onClick={() => void copyText(phone, t("phoneVerify.phoneCopied"), t("phoneVerify.copyFailed"))}><Copy />{t("common.copy")}</Button>
          {wa ? <Button asChild variant="ghost" size="sm"><a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle />{t("phoneVerify.openWhatsapp")}</a></Button> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("phoneVerify.requestedAt", { time: formatDate(row.created_at, locale) })}
          {row.status === "pending_staff" && row.claimed_by_name ? ` · ${t("phoneVerify.claimedBy", { name: row.claimed_by_name })}` : ""}
          {row.status === "rejected" && row.rejection_reason ? ` · ${row.rejection_reason}` : ""}
        </p>
      </div>
      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {actions.includes("claim") ? <Button onClick={onClaim} isLoading={busy}><KeyRound />{claimIsReissue(row) ? t("phoneVerify.claimAgain") : t("phoneVerify.claim")}</Button> : null}
          {actions.includes("reject") ? <Button variant="outline" onClick={onReject} disabled={busy}><XCircle />{t("phoneVerify.reject")}</Button> : null}
        </div>
      ) : null}
    </Card>
  );
}

function CodeDialog({ issued, onClose, onSent }: { issued: IssuedCode | null; onClose: () => void; onSent: () => void }) {
  const { t } = useI18n();
  const send = useMutation({
    mutationFn: async (id: number) => apiFetch(`${BASE}/${id}/mark-sent/`, { method: "POST" }),
    onSuccess() { toast.success(t("phoneVerify.sentDone")); onSent(); },
    onError(error) {
      const key = error instanceof AppApiError ? phoneErrorKey(error.code) : null;
      toast.error(key ? t(key) : apiErrorText(error, t));
    },
  });
  const row = issued?.row ?? null;
  const code = issued?.code ?? "";
  const message = code ? buildWhatsappMessage(code, CODE_VALIDITY_MINUTES) : "";
  const wa = row ? whatsappChatUrl(row.phone_number) : null;
  const phone = row ? displayPhone(row.phone_number) || row.phone_number : "";

  return (
    <Dialog open={issued !== null} onOpenChange={(open) => { if (!open && !send.isPending) { send.reset(); onClose(); } }}>
      <DialogContent className="max-w-md" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t("phoneVerify.codeTitle")}</DialogTitle>
          <DialogDescription>{row?.user_name} · <Ltr as="span">{phone}</Ltr></DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-2xl border bg-muted/40 p-5 text-center">
            <Ltr as="p" className="select-all font-mono text-5xl font-extrabold tracking-[0.3em]" data-testid="phone-verify-code">{code}</Ltr>
          </div>
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-medium text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{t("phoneVerify.codeWarning", { minutes: CODE_VALIDITY_MINUTES })}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={() => void copyText(code, t("phoneVerify.codeCopied"), t("phoneVerify.copyFailed"))}><Copy />{t("phoneVerify.copyCode")}</Button>
            <Button variant="outline" onClick={() => void copyText(message, t("phoneVerify.messageCopied"), t("phoneVerify.copyFailed"))}><Copy />{t("phoneVerify.copyMessage")}</Button>
          </div>
          {wa ? <Button asChild variant="ghost" className="w-full"><a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle />{t("phoneVerify.openWhatsapp")}</a></Button> : null}
        </div>
        <DialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start">
          <Button onClick={() => row && send.mutate(row.id)} isLoading={send.isPending}><Send />{t("phoneVerify.markSent")}</Button>
          <Button variant="outline" onClick={() => { send.reset(); onClose(); }} disabled={send.isPending}>{t("phoneVerify.closeWithoutSending")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({ row, onClose, onDone }: { row: PhoneVerificationRow | null; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const reject = useMutation({
    mutationFn: async ({ id, text }: { id: number; text: string }) => apiFetch(`${BASE}/${id}/reject/`, { method: "POST", body: { reason: text } }),
    onSuccess() { toast.success(t("phoneVerify.rejectDone")); onDone(); },
    onError(error) {
      const key = error instanceof AppApiError ? phoneErrorKey(error.code) : null;
      toast.error(key ? t(key) : apiErrorText(error, t));
    },
  });
  const submit = () => {
    const text = normalizeReason(reason);
    if (!text || !row) { setProblem(t("phoneVerify.reasonRequired")); document.getElementById("phone-verify-reason")?.focus(); return; }
    reject.mutate({ id: row.id, text });
  };
  return (
    <Dialog open={row !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("phoneVerify.rejectTitle")}</DialogTitle><DialogDescription>{row?.user_name}</DialogDescription></DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="phone-verify-reason">{t("phoneVerify.reason")}<span className="ms-1 text-destructive" aria-hidden="true">*</span></Label>
          <Textarea id="phone-verify-reason" value={reason} maxLength={REJECT_REASON_MAX} aria-required aria-invalid={problem ? true : undefined} aria-describedby={problem ? "phone-verify-reason-error" : undefined} onChange={(event) => { setReason(event.target.value); setProblem(null); }} />
          {problem ? <p id="phone-verify-reason-error" role="alert" className="text-xs font-medium text-destructive">{problem}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="destructive" onClick={submit} isLoading={reject.isPending}>{t("phoneVerify.reject")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
