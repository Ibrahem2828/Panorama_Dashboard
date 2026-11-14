"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { fetchAllPages } from "@/components/forms/contract-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FINANCE_PATHS, currentExchangeRate, formatMoney, formatRate, type RateRow } from "@/features/finance/finance-rules";
import {
  EXTRA_CODE_MAX, EXTRA_DESCRIPTION_MAX, EXTRA_NAME_MAX, EXTRA_OPTIONS_PATH, EXTRA_PRICE_UNITS, EXTRA_SORT_MAX, SECTION_BLOCKS,
  deleteRequests, effectiveUsd, emptyForm, entriesOfSection, formFromEntry, groupOptions, missingCurrencies, needsPrice, optionProblems,
  parseExtraOption, priceUnitLabelKey, saveRequests, sectionLabelKey, subSectionLabelKey, toggleRequests, usableRate,
  type ExtraSection, type OptionEntry, type OptionForm, type OptionProblems, type SaveRequest,
} from "@/features/printing/paper-options-rules";
import { Field } from "@/features/printing/segmented";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";
import { apiErrorText } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";

const QUERY_KEY = ["print-extra-options"] as const;

/** Runs the writes of one option one after the other; every failure is collected so a half-saved pair is reported, not hidden. */
async function runRequests(requests: readonly SaveRequest[]): Promise<void> {
  const failures: unknown[] = [];
  for (const request of requests) {
    try {
      await apiFetch(request.path, { method: request.method, body: request.method === "DELETE" ? undefined : request.body });
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length) throw failures[0];
}

function usePaperOptions() {
  const options = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const collection = await normalizeCollection<unknown>(await apiFetch(EXTRA_OPTIONS_PATH));
      return collection.results.map(parseExtraOption).flatMap((row) => (row ? [row] : []));
    },
  });
  // The exchange rate belongs to finance: a user without that capability simply types the dollar price by hand.
  const rates = useQuery({ queryKey: ["print-extra-options", "rate"], retry: false, staleTime: 60_000, queryFn: () => fetchAllPages(FINANCE_PATHS.rates) });
  const rate = useMemo(() => {
    const current = rates.data ? currentExchangeRate(rates.data as RateRow[]) : null;
    return usableRate(current?.syp_per_usd);
  }, [rates.data]);
  const entries = useMemo(() => groupOptions(options.data ?? []), [options.data]);
  return { options, entries, rate };
}

function priceMessage(problem: OptionProblems["syp"], t: ReturnType<typeof useI18n>["t"]): string | null {
  if (!problem) return null;
  return t(problem === "required" ? "paper.form.priceRequired" : problem === "tooMany" ? "paper.form.priceTooMany" : problem === "tooBig" ? "paper.form.priceTooBig" : "paper.form.priceInvalid");
}

function OptionDialog({ section, entry, entries, rate, onClose }: { section: ExtraSection; entry: OptionEntry | null; entries: readonly OptionEntry[]; rate: number | null; onClose: () => void }) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<OptionForm>(() => (entry ? formFromEntry(entry, rate) : emptyForm(section, rate)));
  const [showErrors, setShowErrors] = useState(false);
  const takenCodes = entries.filter((other) => other.section === section).map((other) => other.code);
  const problems = optionProblems(form, rate, entry === null, takenCodes);
  const set = (patch: Partial<OptionForm>) => setForm((current) => ({ ...current, ...patch }));
  const usd = effectiveUsd(form, rate);

  const save = useMutation({
    mutationFn: () => runRequests(saveRequests(form, entry, rate)),
    onSuccess() { toast.success(t("paper.saved")); onClose(); },
    onError: (error) => toast.error(apiErrorText(error, t)),
    // The pair may be half written after a failure, so the list is always re-read.
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: QUERY_KEY }); },
  });

  function submit() {
    setShowErrors(true);
    if (Object.keys(problems).length) return;
    save.mutate();
  }

  const codeMessage = showErrors && problems.code
    ? t(problems.code === "required" ? "paper.form.codeRequired" : problems.code === "format" ? "paper.form.codeFormat" : problems.code === "taken" ? "paper.form.codeTaken" : "paper.form.tooLong", { max: EXTRA_CODE_MAX })
    : null;
  const nameMessage = showErrors && problems.name ? t(problems.name === "required" ? "paper.form.nameRequired" : "paper.form.tooLong", { max: EXTRA_NAME_MAX }) : null;
  const zeroActive = form.isActive && Object.keys(problems).length === 0 && (Number(form.sypPrice) === 0 || Number(usd) === 0);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader className="pe-10">
          <DialogTitle>{entry ? t("paper.edit") : t("paper.add")} · {t(sectionLabelKey(section))}</DialogTitle>
          <DialogDescription>{t("paper.form.hint")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submit(); }} noValidate>
          <Field label={t("paper.form.name")} htmlFor="paper-name" error={nameMessage}>
            <Input id="paper-name" autoFocus value={form.name} onChange={(event) => set({ name: event.target.value })} aria-invalid={Boolean(nameMessage)} className={cn("h-11", nameMessage && "border-destructive")} dir="auto" />
          </Field>
          {entry === null ? (
            <Field label={t("paper.form.code")} htmlFor="paper-code" hint={t("paper.form.codeHint")} error={codeMessage}>
              <Input id="paper-code" value={form.code} onChange={(event) => set({ code: event.target.value.trim().toLowerCase() })} maxLength={EXTRA_CODE_MAX} dir="ltr" aria-invalid={Boolean(codeMessage)} className={cn("h-11", codeMessage && "border-destructive")} />
            </Field>
          ) : null}
          <Field label={t("paper.form.unit")} htmlFor="paper-unit">
            <Select value={form.priceUnit} onValueChange={(value) => set({ priceUnit: value as OptionForm["priceUnit"] })}>
              <SelectTrigger id="paper-unit" className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{EXTRA_PRICE_UNITS.map((unit) => <SelectItem key={unit} value={unit}>{t(priceUnitLabelKey(unit))}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("paper.form.sypPrice")} htmlFor="paper-syp" error={showErrors ? priceMessage(problems.syp, t) : null}>
              <Input id="paper-syp" inputMode="decimal" dir="ltr" value={form.sypPrice} onChange={(event) => set({ sypPrice: event.target.value.replace(/[^\d.]/gu, "") })} aria-invalid={Boolean(showErrors && problems.syp)} className={cn("h-11 tabular-nums", showErrors && problems.syp && "border-destructive")} placeholder="0" />
            </Field>
            <Field label={t("paper.form.usdPrice")} htmlFor="paper-usd" error={showErrors ? priceMessage(problems.usd, t) : null}>
              <Input id="paper-usd" inputMode="decimal" dir="ltr" readOnly={form.usdAuto} value={form.usdAuto ? usd : form.usdPrice} onChange={(event) => set({ usdPrice: event.target.value.replace(/[^\d.]/gu, "") })} aria-invalid={Boolean(showErrors && problems.usd)} className={cn("h-11 tabular-nums", form.usdAuto && "bg-muted/50", showErrors && problems.usd && "border-destructive")} placeholder="0.00" />
            </Field>
          </div>
          {rate !== null ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <Label htmlFor="paper-usd-auto" className="min-w-0">{t("paper.form.usdAuto")}<span className="block text-xs font-normal text-muted-foreground">{t("paper.rate.known", { rate: formatRate(rate, locale) })}</span></Label>
              <Switch id="paper-usd-auto" checked={form.usdAuto} onCheckedChange={(usdAuto) => set(usdAuto ? { usdAuto } : { usdAuto, usdPrice: usd })} />
            </div>
          ) : <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-800 dark:text-amber-200">{t("paper.rate.unknown")}</p>}
          <Field label={t("paper.form.description")} htmlFor="paper-desc" optional={t("counter.optional")} error={showErrors && problems.description ? t("paper.form.tooLong", { max: EXTRA_DESCRIPTION_MAX }) : null}>
            <Textarea id="paper-desc" rows={2} value={form.description} onChange={(event) => set({ description: event.target.value })} dir="auto" />
          </Field>
          <Field label={t("paper.form.sort")} htmlFor="paper-sort" hint={t("paper.form.sortHint")} error={showErrors && problems.sort ? t("paper.form.sortInvalid", { max: EXTRA_SORT_MAX }) : null}>
            <Input id="paper-sort" inputMode="numeric" dir="ltr" value={form.sortOrder} onChange={(event) => set({ sortOrder: event.target.value.replace(/\D/gu, "").slice(0, 5) })} className="h-11 w-28 tabular-nums" />
          </Field>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <Label htmlFor="paper-active" className="min-w-0">{t("paper.form.active")}<span className="block text-xs font-normal text-muted-foreground">{t("paper.form.activeHint")}</span></Label>
            <Switch id="paper-active" checked={form.isActive} onCheckedChange={(isActive) => set({ isActive })} />
          </div>
          {zeroActive ? <p className="text-xs text-muted-foreground" role="status">{t("paper.form.zeroActive")}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={save.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SectionTable({ section, entries, busy, onAdd, onEdit, onToggle, onDelete, showHeading }: {
  section: ExtraSection; entries: readonly OptionEntry[]; busy: string | null; showHeading: boolean;
  onAdd: () => void; onEdit: (entry: OptionEntry) => void; onToggle: (entry: OptionEntry, isActive: boolean) => void; onDelete: (entry: OptionEntry) => void;
}) {
  const { t, locale } = useI18n();
  const subKey = subSectionLabelKey(section);
  const rows = entriesOfSection(entries, section);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {showHeading && subKey ? <h4 className="text-sm font-bold">{t(subKey)}</h4> : <span />}
        <Button type="button" size="sm" variant="outline" onClick={onAdd}><Plus />{t("paper.add")}</Button>
      </div>
      {rows.length === 0 ? <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{t("paper.sectionEmpty")}</p> : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="p-2.5 text-start font-semibold">{t("paper.col.name")}</th>
                <th scope="col" className="p-2.5 text-start font-semibold">{t("paper.col.syp")}</th>
                <th scope="col" className="p-2.5 text-start font-semibold">{t("paper.col.usd")}</th>
                <th scope="col" className="p-2.5 text-start font-semibold">{t("paper.col.unit")}</th>
                <th scope="col" className="p-2.5 text-start font-semibold">{t("paper.col.active")}</th>
                <th scope="col" className="w-24 p-2.5"><span className="sr-only">{t("common.actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => {
                const missing = missingCurrencies(entry);
                const working = busy === entry.key;
                return (
                  <tr key={entry.key} className={cn("border-t align-top hover:bg-muted/30", !entry.isActive && "text-muted-foreground")}>
                    <td className="min-w-[14rem] p-2.5">
                      <p className="break-words font-semibold" dir="auto">{entry.name}</p>
                      {entry.description ? <p className="mt-0.5 break-words text-xs text-muted-foreground" dir="auto">{entry.description}</p> : null}
                      {needsPrice(entry) ? (
                        <p className="mt-1 flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs leading-5 text-amber-800 dark:text-amber-200" role="note">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{t("paper.needsPrice")}
                        </p>
                      ) : null}
                      {missing.length ? <p className="mt-1 text-xs text-destructive">{t("paper.missingRow", { currency: missing.join(" / ") })}</p> : null}
                    </td>
                    <td className="p-2.5 tabular-nums"><bdi>{entry.rows.SYP ? formatMoney(entry.rows.SYP.price, "SYP", locale) : "—"}</bdi></td>
                    <td className="p-2.5 tabular-nums"><bdi>{entry.rows.USD ? formatMoney(entry.rows.USD.price, "USD", locale) : "—"}</bdi></td>
                    <td className="p-2.5"><Badge variant="outline" className="whitespace-nowrap rounded-full">{t(priceUnitLabelKey(entry.priceUnit))}</Badge></td>
                    <td className="p-2.5"><Switch checked={entry.isActive} disabled={working} aria-label={`${t("paper.col.active")}: ${entry.name}`} onCheckedChange={(next) => onToggle(entry, next)} /></td>
                    <td className="p-2.5">
                      <div className="flex gap-1">
                        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`${t("paper.edit")}: ${entry.name}`} onClick={() => onEdit(entry)}><Pencil className="size-4" /></Button>
                        <ConfirmDialog
                          trigger={<Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label={`${t("common.delete")}: ${entry.name}`} disabled={working}><Trash2 className="size-4" /></Button>}
                          title={t("paper.deleteTitle")} description={t("paper.deleteBody", { name: entry.name })} confirmLabel={t("common.delete")} cancelLabel={t("common.cancel")} onConfirm={() => onDelete(entry)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** «خيارات الورق حسب القسم»: the owner's list of paper options per section of the order form, each with its pound and dollar price. */
export function PaperOptionsPanel() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { options, entries, rate } = usePaperOptions();
  const [editing, setEditing] = useState<{ section: ExtraSection; entry: OptionEntry | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: QUERY_KEY }); };

  const toggle = useMutation({
    mutationFn: async (input: { entry: OptionEntry; isActive: boolean }) => { setBusy(input.entry.key); await runRequests(toggleRequests(input.entry, input.isActive)); },
    onError: (error) => toast.error(apiErrorText(error, t)),
    onSettled: () => { setBusy(null); refresh(); },
  });
  const remove = useMutation({
    mutationFn: async (entry: OptionEntry) => { setBusy(entry.key); await runRequests(deleteRequests(entry)); },
    onSuccess: () => toast.success(t("paper.removed")),
    onError: (error) => toast.error(apiErrorText(error, t)),
    onSettled: () => { setBusy(null); refresh(); },
  });

  if (options.isPending) return <Skeleton className="h-64 rounded-2xl" />;
  if (options.isError) return <ErrorPanel error={options.error} retry={() => options.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-black">{t("paper.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("paper.subtitle")}</p>
      </div>
      {entries.length === 0 ? <p className="rounded-2xl border bg-card p-6 text-center text-sm leading-6 text-muted-foreground">{t("paper.emptyAll")}</p> : null}
      {SECTION_BLOCKS.map((block) => (
        <Card key={block.id}>
          <CardHeader className="pb-3"><CardTitle className="text-base">{t(block.labelKey)}</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {block.sections.map((section) => (
              <SectionTable
                key={section} section={section} entries={entries} busy={busy} showHeading={block.sections.length > 1}
                onAdd={() => setEditing({ section, entry: null })} onEdit={(entry) => setEditing({ section, entry })}
                onToggle={(entry, isActive) => toggle.mutate({ entry, isActive })} onDelete={(entry) => remove.mutate(entry)}
              />
            ))}
          </CardContent>
        </Card>
      ))}
      {editing ? <OptionDialog key={editing.entry?.key ?? `new-${editing.section}`} section={editing.section} entry={editing.entry} entries={entries} rate={rate} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
