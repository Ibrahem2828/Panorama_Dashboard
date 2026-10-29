"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ErrorPanel } from "@/components/feedback/error-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEndTerm, useEndTermPreview, useSemesterOptions, type CurrentTerm, type EndTermResult } from "@/features/academic-term/api";
import { CONFIRM_WORD, confirmationMatches, previewTotals, termLabelProblem } from "@/features/academic-term/rules";
import { useI18n } from "@/i18n/provider";
import { apiErrorText } from "@/lib/api/error-message";
import { newIdempotencyKey } from "@/lib/api/idempotency";
import { formatNumber } from "@/lib/utils";

type Step = 1 | 2 | 3;

/**
 * "End semester" in three deliberate steps: choose the next semester, read the server's preview (nothing has changed
 * yet), then type a confirmation. Only the last button changes data.
 */
export function EndTermWizard(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: CurrentTerm | undefined;
  onDone: (result: EndTermResult) => void;
}) {
  // Mounted only while open, so every opening starts from a clean form, a fresh preview and a fresh idempotency key.
  return props.open ? <WizardBody onOpenChange={props.onOpenChange} current={props.current} onDone={props.onDone} /> : null;
}

function WizardBody({ onOpenChange, current, onDone }: {
  onOpenChange: (open: boolean) => void;
  current: CurrentTerm | undefined;
  onDone: (result: EndTermResult) => void;
}) {
  const { t, locale, direction } = useI18n();
  const [step, setStep] = useState<Step>(1);
  const [nextSemester, setNextSemester] = useState<string>("");
  const [label, setLabel] = useState("");
  const [disableLinks, setDisableLinks] = useState(true);
  const [typed, setTyped] = useState("");
  const [touched, setTouched] = useState(false);
  const semesters = useSemesterOptions();
  const preview = useEndTermPreview();
  const endTerm = useEndTerm();
  // One key per logical "end the term" so a double click or a retry after a dropped response cannot end two terms.
  const idempotencyKey = useRef(newIdempotencyKey());
  const Forward = direction === "rtl" ? ArrowLeft : ArrowRight;
  const Backward = direction === "rtl" ? ArrowRight : ArrowLeft;

  const labelProblem = termLabelProblem(label);
  const canPreview = Boolean(nextSemester) && !labelProblem;
  const totals = preview.data ? previewTotals(preview.data.groups) : null;
  const confirmed = preview.data ? confirmationMatches(typed, preview.data.total_students) : false;

  const loadPreview = () => {
    setTouched(true);
    if (!canPreview) return;
    preview.mutate(undefined, { onSuccess: () => setStep(2) });
  };
  const execute = () => {
    if (!preview.data || !confirmed) return;
    endTerm.mutate(
      { body: { confirm: true, next_semester: Number(nextSemester), label: label.trim(), disable_whatsapp_links: disableLinks }, idempotencyKey: idempotencyKey.current },
      {
        onSuccess: (result) => { toast.success(t("term.endedToast")); onDone(result); onOpenChange(false); },
        onError: (error) => toast.error(apiErrorText(error, t)),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(next) => { if (!endTerm.isPending) onOpenChange(next); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("term.wizardTitle")}</DialogTitle>
          <DialogDescription>{t("term.wizardStep", { step: formatNumber(step, locale), total: formatNumber(3, locale) })}</DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/40 p-3 text-sm">{t("term.currentIs", { name: current?.semester?.name ?? "—", label: current?.term_label || "—" })}</div>
            <div className="space-y-2">
              <Label htmlFor="next-semester">{t("term.nextSemester")}</Label>
              {semesters.isError ? <ErrorPanel error={semesters.error} retry={() => semesters.refetch()} /> : (
                <Select value={nextSemester} onValueChange={setNextSemester} disabled={semesters.isPending}>
                  <SelectTrigger id="next-semester" aria-invalid={touched && !nextSemester}><SelectValue placeholder={semesters.isPending ? t("common.loading") : t("term.pickSemester")} /></SelectTrigger>
                  <SelectContent>{semesters.data?.map((semester) => <SelectItem key={semester.id} value={String(semester.id)}>{semester.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {touched && !nextSemester ? <p role="alert" className="text-xs text-destructive">{t("common.required")}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="term-label">{t("term.label")}</Label>
              <Input id="term-label" value={label} maxLength={130} onChange={(event) => setLabel(event.target.value)} placeholder={t("term.labelPlaceholder")} aria-invalid={touched && Boolean(labelProblem)} />
              {touched && labelProblem ? <p role="alert" className="text-xs text-destructive">{labelProblem === "required" ? t("common.required") : t("term.labelTooLong")}</p> : null}
            </div>
            <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
              <div>
                <Label htmlFor="disable-links" className="font-bold">{t("term.disableLinks")}</Label>
                <p className="mt-1 text-xs text-muted-foreground">{t("term.disableLinksHint")}</p>
              </div>
              <Switch id="disable-links" checked={disableLinks} onCheckedChange={setDisableLinks} />
            </div>
            {preview.isError ? <ErrorPanel error={preview.error} retry={loadPreview} /> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
              <Button type="button" onClick={loadPreview} isLoading={preview.isPending} disabled={preview.isPending}>{t("term.showPreview")}<Forward /></Button>
            </div>
          </div>
        ) : null}

        {step === 2 && preview.data && totals ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("term.previewIntro")}</p>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                [t("term.totalStudents"), preview.data.total_students],
                [t("term.totalMemberships"), preview.data.total_memberships],
                [t("term.totalGroups"), totals.groups],
              ].map(([name, value]) => (
                <div key={String(name)} className="rounded-xl border p-3"><dd className="text-2xl font-black">{formatNumber(Number(value), locale)}</dd><dt className="text-xs text-muted-foreground">{name}</dt></div>
              ))}
            </dl>
            {preview.data.groups.length ? (
              <div className="max-h-72 overflow-auto rounded-xl border">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>{t("term.colGroup")}</TableHead><TableHead>{t("term.colSubject")}</TableHead><TableHead>{t("term.colWhatsapp")}</TableHead><TableHead className="text-end">{t("term.colMembers")}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {preview.data.groups.map((group) => (
                      <TableRow key={group.group_id}>
                        <TableCell className="font-semibold">{group.name}</TableCell>
                        <TableCell>{group.subject ?? "—"}</TableCell>
                        <TableCell>{group.whatsapp_active ? t("common.yes") : t("common.no")}</TableCell>
                        <TableCell className="text-end font-bold">{formatNumber(group.members_to_remove, locale)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">{t("term.previewEmpty")}</p>}
            <div className="flex justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}><Backward />{t("term.back")}</Button>
              <Button type="button" onClick={() => setStep(3)}>{t("term.continueToConfirm")}<Forward /></Button>
            </div>
          </div>
        ) : null}

        {step === 3 && preview.data ? (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); execute(); }}>
            <div role="alert" className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <p>{t("term.finalWarning", { students: formatNumber(preview.data.total_students, locale), memberships: formatNumber(preview.data.total_memberships, locale) })}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-text">{t("term.typeToConfirm", { word: CONFIRM_WORD, count: formatNumber(preview.data.total_students, locale) })}</Label>
              <Input id="confirm-text" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" autoFocus />
            </div>
            {endTerm.isError ? <ErrorPanel error={endTerm.error} /> : null}
            <div className="flex justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={endTerm.isPending}><Backward />{t("term.back")}</Button>
              <Button type="submit" variant="destructive" disabled={!confirmed || endTerm.isPending} isLoading={endTerm.isPending}><ShieldCheck />{t("term.endNow")}</Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
