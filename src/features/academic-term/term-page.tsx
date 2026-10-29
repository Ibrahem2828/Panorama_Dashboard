"use client";

import { CalendarRange, CheckCircle2, Database, History, Power, Undo2, UserMinus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EndTermWizard } from "@/features/academic-term/end-term-wizard";
import { termLabelProblem } from "@/features/academic-term/rules";
import { useAdminTerm, useRollovers, useSemesterOptions, useSetCurrentTerm, useUndoRollover, type EndTermResult, type RolloverRow } from "@/features/academic-term/api";
import { WhatsappRemovals } from "@/features/academic-term/whatsapp-removals";
import { useI18n } from "@/i18n/provider";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { apiErrorText } from "@/lib/api/error-message";
import { formatDate, formatNumber } from "@/lib/utils";

/** Plain-language promise of what ending a term does and does not touch. Shown before anything can be pressed. */
function ScopeCard() {
  const { t } = useI18n();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <section aria-labelledby="term-removed" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <h3 id="term-removed" className="mb-2 flex items-center gap-2 font-black text-destructive"><UserMinus className="size-5" />{t("term.endsTitle")}</h3>
        <ul className="list-disc space-y-1 ps-5 text-sm">
          <li>{t("term.ends1")}</li>
          <li>{t("term.ends2")}</li>
          <li>{t("term.ends3")}</li>
        </ul>
      </section>
      <section aria-labelledby="term-kept" className="rounded-xl border border-emerald-600/30 bg-emerald-600/5 p-4">
        <h3 id="term-kept" className="mb-2 flex items-center gap-2 font-black text-emerald-700 dark:text-emerald-400"><Database className="size-5" />{t("term.keepsTitle")}</h3>
        <ul className="list-disc space-y-1 ps-5 text-sm">
          <li>{t("term.keeps1")}</li>
          <li>{t("term.keeps2")}</li>
          <li>{t("term.keeps3")}</li>
        </ul>
      </section>
    </div>
  );
}

function CurrentTermCard() {
  const { t, locale } = useI18n();
  const term = useAdminTerm();
  const semesters = useSemesterOptions();
  const save = useSetCurrentTerm();
  // What the admin typed; until they type, the form shows what the server says (and follows it after a save or rollover).
  const [edits, setEdits] = useState<{ semester?: string; label?: string }>({});
  const [touched, setTouched] = useState(false);
  const serverSemester = term.data?.semester?.id;
  const serverLabel = term.data?.term_label;
  const semester = edits.semester ?? (serverSemester !== undefined ? String(serverSemester) : "");
  const label = edits.label ?? serverLabel ?? "";
  const setSemester = (value: string) => setEdits((previous) => ({ ...previous, semester: value }));
  const setLabel = (value: string) => setEdits((previous) => ({ ...previous, label: value }));

  const problem = termLabelProblem(label);
  const dirty = semester !== String(serverSemester ?? "") || label.trim() !== (serverLabel ?? "");
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!semester || problem) return;
    save.mutate({ semester: Number(semester), label: label.trim() }, {
      onSuccess: () => { toast.success(t("term.savedToast")); setTouched(false); setEdits({}); },
      onError: (error) => toast.error(apiErrorText(error, t)),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarRange className="size-5 text-primary" />{t("term.currentTitle")}</CardTitle>
        <CardDescription>{t("term.currentHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {term.isPending ? <Skeleton className="h-24 rounded-xl" /> : term.isError ? <ErrorPanel error={term.error} retry={() => term.refetch()} /> : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">{t("term.currentSemester")}</div><div className="mt-1 text-lg font-black">{term.data.semester?.name ?? t("term.notSet")}</div></div>
              <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">{t("term.otherSemester")}</div><div className="mt-1 text-lg font-black">{term.data.other_semester?.name ?? "—"}</div></div>
              <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">{t("term.startedAt")}</div><div className="mt-1 text-sm font-bold">{term.data.term_started_at ? formatDate(term.data.term_started_at, locale) : "—"}</div><div className="mt-0.5 truncate text-xs text-muted-foreground">{term.data.term_label}</div></div>
            </div>
            <form className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={submit} noValidate>
              <div className="space-y-2">
                <Label htmlFor="current-semester">{t("term.setSemester")}</Label>
                <Select value={semester} onValueChange={setSemester} disabled={semesters.isPending}>
                  <SelectTrigger id="current-semester"><SelectValue placeholder={t("term.pickSemester")} /></SelectTrigger>
                  <SelectContent>{semesters.data?.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="current-label">{t("term.label")}</Label>
                <Input id="current-label" value={label} maxLength={130} onChange={(event) => setLabel(event.target.value)} placeholder={t("term.labelPlaceholder")} aria-invalid={touched && Boolean(problem)} />
                {touched && problem ? <p role="alert" className="text-xs text-destructive">{problem === "required" ? t("common.required") : t("term.labelTooLong")}</p> : null}
              </div>
              <Button type="submit" isLoading={save.isPending} disabled={save.isPending || !dirty}>{t("common.save")}</Button>
            </form>
            <p className="text-xs text-muted-foreground">{t("term.setHint")}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function rolloverActor(row: RolloverRow): string {
  const by = row.performed_by;
  return typeof by === "string" ? by : by?.full_name ?? "";
}

function RolloverHistory({ openId, onOpen }: { openId: number | null; onOpen: (id: number | null) => void }) {
  const { t, locale } = useI18n();
  const rollovers = useRollovers();
  const undo = useUndoRollover();

  const doUndo = (id: number) => undo.mutate(id, {
    onSuccess: () => toast.success(t("term.undoneToast")),
    onError: (error) => toast.error(apiErrorText(error, t)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><History className="size-5 text-primary" />{t("term.historyTitle")}</CardTitle>
        <CardDescription>{t("term.historyHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rollovers.isPending ? <Skeleton className="h-24 rounded-xl" /> : rollovers.isError ? <ErrorPanel error={rollovers.error} retry={() => rollovers.refetch()} /> : !rollovers.data.length ? (
          <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">{t("term.historyEmpty")}</p>
        ) : (
          <ul className="space-y-3">
            {rollovers.data.map((row, index) => {
              const latest = row.is_latest ?? index === 0;
              const undone = Boolean(row.undone_at);
              const expanded = openId === row.id;
              return (
                <li key={row.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold">{row.label || t("term.rolloverNumber", { id: formatNumber(row.id, locale) })}{undone ? <span className="ms-2 rounded-full border px-2 py-0.5 text-[10px] font-normal text-muted-foreground">{t("term.undone")}</span> : null}</div>
                      <div className="text-xs text-muted-foreground">
                        {[row.created_at ? formatDate(row.created_at, locale) : "", rolloverActor(row), row.removed !== undefined ? t("term.removedCount", { count: formatNumber(row.removed, locale) }) : ""].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" aria-expanded={expanded} onClick={() => onOpen(expanded ? null : row.id)}>{expanded ? t("term.hideList") : t("term.showList")}</Button>
                      {latest && !undone ? (
                        <ConfirmDialog
                          trigger={<Button type="button" size="sm" variant="outline" disabled={undo.isPending}><Undo2 />{t("term.undo")}</Button>}
                          title={t("term.undoTitle")}
                          description={t("term.undoDescription")}
                          confirmLabel={t("term.undo")}
                          cancelLabel={t("common.cancel")}
                          onConfirm={() => doUndo(row.id)}
                        />
                      ) : null}
                    </div>
                  </div>
                  {expanded ? <div className="mt-4 border-t pt-4"><WhatsappRemovals rolloverId={row.id} /></div> : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function TermPage() {
  const { t, locale } = useI18n();
  const term = useAdminTerm();
  const [wizard, setWizard] = useState(false);
  const [result, setResult] = useState<EndTermResult | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const undo = useUndoRollover();

  return (
    <CapabilityGate capability={CAPABILITIES.academic}>
      <div className="space-y-6">
        <PageHeader title={t("term.title")} description={t("term.subtitle")} eyebrow={t("nav.academic")} />
        <CurrentTermCard />

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Power className="size-5 text-destructive" />{t("term.endTitle")}</CardTitle>
            <CardDescription>{t("term.endHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScopeCard />
            <p className="text-sm text-muted-foreground">{t("term.whatsappNote")}</p>
            <Button type="button" variant="destructive" size="lg" onClick={() => setWizard(true)} disabled={term.isPending}><Power />{t("term.endButton")}</Button>
          </CardContent>
        </Card>

        {result ? (
          <Card className="border-emerald-600/40" aria-live="polite">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-600" />{t("term.resultTitle")}</CardTitle>
              <CardDescription>{t("term.resultSummary", { count: formatNumber(result.removed, locale), groups: formatNumber(result.groups.length, locale) })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <ConfirmDialog
                  trigger={<Button type="button" variant="outline" disabled={undo.isPending}><Undo2 />{t("term.undo")}</Button>}
                  title={t("term.undoTitle")}
                  description={t("term.undoDescription")}
                  confirmLabel={t("term.undo")}
                  cancelLabel={t("common.cancel")}
                  onConfirm={() => undo.mutate(result.rollover_id, {
                    onSuccess: () => { toast.success(t("term.undoneToast")); setResult(null); },
                    onError: (error) => toast.error(apiErrorText(error, t)),
                  })}
                />
              </div>
              <WhatsappRemovals rolloverId={result.rollover_id} />
            </CardContent>
          </Card>
        ) : null}

        <RolloverHistory openId={openId} onOpen={setOpenId} />
        <EndTermWizard open={wizard} onOpenChange={setWizard} current={term.data} onDone={(done) => { setResult(done); setOpenId(null); }} />
      </div>
    </CapabilityGate>
  );
}
