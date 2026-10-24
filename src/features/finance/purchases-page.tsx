"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Download, Paperclip, Plus, Search, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Pagination } from "@/components/data-grid/pagination";
import { CapabilityGate } from "@/components/feedback/capability-gate";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { FINANCE_CURRENCIES, type FinanceCurrency } from "@/features/finance/finance-rules";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useIdempotencyKey, useMutationError } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages";
import { apiFetch, normalizeCollection, unwrap } from "@/lib/api/browser-client";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { formatDate } from "@/lib/utils";

const KINDS = ["purchases", "consumables", "miscellaneous", "equipment"] as const;
type Kind = (typeof KINDS)[number];

interface Purchase {
  id: number; spent_on: string; kind: Kind; description: string; amount: string; currency: string;
  supplier: string; notes: string; has_invoice: boolean; reminder: number | null; reminder_name: string | null;
}
interface Reminder {
  id: number; name: string; interval_weeks: number; is_active: boolean;
  last_purchase: string | null; weeks_since: number | null; due_on: string | null; is_due: boolean;
}
interface PurchaseReport { month: string; by_kind: Record<string, Record<string, string>>; totals: Record<string, string>; count: number }

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => today().slice(0, 7);
const money = (amount: string, currency: string) => `${Number(amount).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency === "USD" ? "$" : "ل.س"}`;

/** The purchases screen: record what was bought in a few fields (kind, amount, supplier, invoice), search it and see the month's totals. */
export function PurchasesPage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<string>("all");
  const [searchDraft, setSearchDraft] = useState("");
  const search = useDebouncedValue(searchDraft);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  // `?new=1` (from the quick-access panel) opens the quick-add form straight away.
  const [adding, setAdding] = useState(useSearchParams()?.get("new") === "1");
  const [reminderDialog, setReminderDialog] = useState(false);
  const month = thisMonth();

  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    if (kind !== "all") params.set("kind", kind);
    if (search) params.set("search", search);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params;
  }, [kind, search, from, to]);

  const list = useQuery({
    queryKey: ["purchases", filterParams.toString(), page],
    queryFn: async () => {
      const params = new URLSearchParams(filterParams);
      params.set("page", String(page)); params.set("page_size", "25");
      return normalizeCollection<Purchase>(await apiFetch(`/api/v1/dashboard/finance/expenses/?${params}`));
    },
  });
  const report = useQuery({
    queryKey: ["purchases-report", month],
    queryFn: async () => unwrap<PurchaseReport>(apiFetch(`/api/v1/dashboard/finance/purchases-report/?month=${month}`)) as Promise<PurchaseReport>,
  });
  const reminders = useQuery({
    queryKey: ["purchase-reminders"],
    queryFn: async () => normalizeCollection<Reminder>(await apiFetch("/api/v1/dashboard/finance/purchase-reminders/?page_size=50")),
  });

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["purchases"] });
    await queryClient.invalidateQueries({ queryKey: ["purchases-report"] });
    await queryClient.invalidateQueries({ queryKey: ["purchase-reminders"] });
  };
  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/v1/dashboard/finance/expenses/${id}/`, { method: "DELETE" }),
    onSuccess: async () => { toast.success(t("common.success")); await refreshAll(); },
    onError: () => toast.error(t("purchases.failed")),
  });

  const exportCsv = async () => {
    const response = await apiFetch(`/api/v1/dashboard/finance/expenses/export/?${filterParams}`);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url; link.download = "purchases.csv"; link.click();
    URL.revokeObjectURL(url);
  };

  const dueReminders = (reminders.data?.results ?? []).filter((reminder) => reminder.is_due);

  return (
    <CapabilityGate capability={CAPABILITIES.finance}>
      <PageHeader
        title={t("purchases.title")}
        description={t("purchases.subtitle")}
        actions={<div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setReminderDialog(true)}><BellRing className="size-4" />{t("purchases.reminders")}</Button>
          <Button variant="outline" onClick={() => void exportCsv()}><Download className="size-4" />{t("purchases.export")}</Button>
          <Button onClick={() => setAdding(true)}><Plus className="size-4" />{t("purchases.add")}</Button>
        </div>}
      />

      {dueReminders.length > 0 ? (
        <div role="status" className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-semibold">{t("purchases.dueTitle")}</p>
          <ul className="mt-1 list-inside list-disc">
            {dueReminders.map((reminder) => <li key={reminder.id}>{t("purchases.dueLine", { name: reminder.name, weeks: reminder.weeks_since ?? 0 })}</li>)}
          </ul>
        </div>
      ) : null}

      <section aria-label={t("purchases.monthReport")} className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {KINDS.map((value) => (
          <Card key={value}>
            <CardHeader className="pb-2"><CardDescription>{t(`purchases.kind.${value}` as MessageKey)}</CardDescription></CardHeader>
            <CardContent className="space-y-1 text-lg font-bold">
              {report.isLoading ? <Skeleton className="h-6 w-24" /> : Object.entries(report.data?.by_kind[value] ?? {}).length === 0
                ? <span className="text-sm font-normal text-muted-foreground">—</span>
                : Object.entries(report.data?.by_kind[value] ?? {}).map(([currency, amount]) => <div key={currency} dir="ltr" className="text-start">{money(amount, currency)}</div>)}
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="absolute start-3 top-3 size-4 text-muted-foreground" />
            <Input className="ps-9" placeholder={t("purchases.search")} value={searchDraft} onChange={(event) => { setSearchDraft(event.target.value); setPage(1); }} />
          </div>
          <Select value={kind} onValueChange={(value) => { setKind(value); setPage(1); }}>
            <SelectTrigger aria-label={t("purchases.kindLabel")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {KINDS.map((value) => <SelectItem key={value} value={value}>{t(`purchases.kind.${value}` as MessageKey)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" aria-label={t("purchases.from")} value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
          <Input type="date" aria-label={t("purchases.to")} value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
        </CardContent>
      </Card>

      {list.isLoading ? <Skeleton className="h-64 w-full rounded-2xl" /> : list.isError ? <ErrorPanel error={list.error} retry={() => void list.refetch()} /> : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-start">
                <tr>{(["date", "kind", "description", "supplier", "amount"] as const).map((key) => <th key={key} className="p-3 text-start font-semibold">{t(`purchases.col.${key}` as MessageKey)}</th>)}<th className="w-12 p-3" /></tr>
              </thead>
              <tbody>
                {list.data?.results.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{t("purchases.empty")}</td></tr> : null}
                {list.data?.results.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="p-3 whitespace-nowrap">{formatDate(row.spent_on, locale)}</td>
                    <td className="p-3"><Badge variant="outline">{t(`purchases.kind.${row.kind}` as MessageKey)}</Badge></td>
                    <td className="p-3">{row.description}{row.has_invoice ? <Paperclip aria-label={t("purchases.hasInvoice")} className="ms-1 inline size-3.5 text-muted-foreground" /> : null}{row.reminder_name ? <span className="ms-2 text-xs text-muted-foreground">({row.reminder_name})</span> : null}</td>
                    <td className="p-3">{row.supplier || "—"}</td>
                    <td className="p-3 whitespace-nowrap font-semibold" dir="ltr">{money(row.amount, row.currency)}</td>
                    <td className="p-3"><Button size="icon" variant="ghost" aria-label={t("purchases.delete")} disabled={remove.isPending} onClick={() => { if (window.confirm(t("purchases.confirmDelete"))) remove.mutate(row.id); }}><Trash2 className="size-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      {list.data ? <Pagination page={page} pageSize={25} count={list.data.count} onPage={setPage} onPageSize={() => undefined} /> : null}

      {adding ? <AddPurchaseDialog reminders={reminders.data?.results ?? []} onClose={() => setAdding(false)} onSaved={refreshAll} /> : null}
      {reminderDialog ? <RemindersDialog reminders={reminders.data?.results ?? []} onClose={() => setReminderDialog(false)} onChanged={refreshAll} /> : null}
    </CapabilityGate>
  );
}

function AddPurchaseDialog({ reminders, onClose, onSaved }: { reminders: Reminder[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const { t } = useI18n();
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<Kind>("purchases");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<FinanceCurrency>("SYP");
  const [spentOn, setSpentOn] = useState(today());
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [reminder, setReminder] = useState("none");
  const [invoice, setInvoice] = useState<File | null>(null);
  const [touched, setTouched] = useState(false);
  const keys = useIdempotencyKey();
  const keyError = useMutationError(keys);
  const valid = description.trim().length > 0 && /^\d+(?:\.\d{1,2})?$/u.test(amount) && Number(amount) > 0;

  const save = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append("description", description.trim());
      form.append("kind", kind);
      form.append("category", kind === "equipment" ? "equipment" : kind === "consumables" ? "supplies" : "other");
      form.append("amount", amount);
      form.append("currency", currency);
      form.append("spent_on", spentOn);
      if (supplier.trim()) form.append("supplier", supplier.trim());
      if (notes.trim()) form.append("notes", notes.trim());
      if (reminder !== "none") form.append("reminder", reminder);
      if (invoice) form.append("invoice", invoice);
      return apiFetch("/api/v1/dashboard/finance/expenses/", { method: "POST", body: form, idempotencyKey: keys.get(`${description}|${amount}|${spentOn}|${invoice?.name ?? ""}`) });
    },
    onSuccess: async () => { keys.reset(); toast.success(t("common.success")); await onSaved(); onClose(); },
    onError: keyError,
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !save.isPending) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("purchases.add")}</DialogTitle><DialogDescription>{t("purchases.addHint")}</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); setTouched(true); if (valid && !save.isPending) save.mutate(); }}>
          <div className="space-y-2">
            <Label htmlFor="p-desc">{t("purchases.col.description")}<span className="ms-1 text-destructive" aria-hidden="true">*</span></Label>
            <Input id="p-desc" autoFocus value={description} maxLength={255} onChange={(event) => setDescription(event.target.value)} aria-invalid={touched && !description.trim() ? true : undefined} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("purchases.kindLabel")}</Label>
              <Select value={kind} onValueChange={(value) => setKind(value as Kind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{KINDS.map((value) => <SelectItem key={value} value={value}>{t(`purchases.kind.${value}` as MessageKey)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label htmlFor="p-date">{t("purchases.col.date")}</Label><Input id="p-date" type="date" value={spentOn} onChange={(event) => setSpentOn(event.target.value)} /></div>
            <div className="space-y-2">
              <Label htmlFor="p-amount">{t("purchases.col.amount")}<span className="ms-1 text-destructive" aria-hidden="true">*</span></Label>
              <Input id="p-amount" dir="ltr" className="text-start" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={touched && !valid ? true : undefined} />
            </div>
            <div className="space-y-2">
              <Label>{t("purchases.currency")}</Label>
              <Select value={currency} onValueChange={(value) => setCurrency(value as FinanceCurrency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FINANCE_CURRENCIES.map((code) => <SelectItem key={code} value={code}>{code === "USD" ? "$ USD" : "ل.س SYP"}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="p-supplier">{t("purchases.col.supplier")}</Label><Input id="p-supplier" value={supplier} maxLength={150} onChange={(event) => setSupplier(event.target.value)} /></div>
            <div className="space-y-2">
              <Label>{t("purchases.reminderLink")}</Label>
              <Select value={reminder} onValueChange={setReminder}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("purchases.noReminder")}</SelectItem>
                  {reminders.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label htmlFor="p-notes">{t("purchases.notes")}</Label><Textarea id="p-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
          <div className="space-y-2">
            <Label htmlFor="p-invoice">{t("purchases.invoice")}</Label>
            <Input id="p-invoice" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => setInvoice(event.target.files?.[0] ?? null)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>{t("common.cancel")}</Button>
            <Button type="submit" isLoading={save.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemindersDialog({ reminders, onClose, onChanged }: { reminders: Reminder[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [weeks, setWeeks] = useState("10");
  const create = useMutation({
    mutationFn: () => apiFetch("/api/v1/dashboard/finance/purchase-reminders/", { method: "POST", body: { name: name.trim(), interval_weeks: Number(weeks) } }),
    onSuccess: async () => { setName(""); toast.success(t("common.success")); await onChanged(); },
    onError: () => toast.error(t("purchases.failed")),
  });
  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/v1/dashboard/finance/purchase-reminders/${id}/`, { method: "DELETE" }),
    onSuccess: onChanged,
    onError: () => toast.error(t("purchases.failed")),
  });
  const valid = name.trim().length > 0 && Number(weeks) >= 1;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("purchases.reminders")}</DialogTitle><DialogDescription>{t("purchases.remindersHint")}</DialogDescription></DialogHeader>
        <ul className="space-y-2">
          {reminders.length === 0 ? <li className="text-sm text-muted-foreground">{t("purchases.noReminders")}</li> : null}
          {reminders.map((reminder) => (
            <li key={reminder.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <div>
                <div className="font-semibold">{reminder.name}{reminder.is_due ? <Badge className="ms-2" variant="destructive">{t("purchases.due")}</Badge> : null}</div>
                <div className="text-xs text-muted-foreground">
                  {t("purchases.every", { weeks: reminder.interval_weeks })} · {reminder.last_purchase ? t("purchases.lastBought", { weeks: reminder.weeks_since ?? 0 }) : t("purchases.neverBought")}
                </div>
              </div>
              <Button size="icon" variant="ghost" aria-label={t("purchases.delete")} onClick={() => remove.mutate(reminder.id)}><Trash2 className="size-4" /></Button>
            </li>
          ))}
        </ul>
        <form className="grid gap-3 sm:grid-cols-[1fr_7rem_auto]" onSubmit={(event) => { event.preventDefault(); if (valid && !create.isPending) create.mutate(); }}>
          <Input placeholder={t("purchases.reminderName")} value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          <Input aria-label={t("purchases.weeks")} type="number" min={1} max={104} value={weeks} onChange={(event) => setWeeks(event.target.value)} />
          <Button type="submit" disabled={!valid} isLoading={create.isPending}><Plus className="size-4" />{t("purchases.addReminder")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
