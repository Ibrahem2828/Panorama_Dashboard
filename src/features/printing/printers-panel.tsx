"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Printer as PrinterIcon, RefreshCw, Search, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  EMPTY_PRINTER_FORM, PRINTER_NAME_MAX, PRINTER_NOTES_MAX, PRINTER_PATHS, PRINTER_REFRESH_MS, PRINTER_STATION_MAX,
  formFromPrinter, formatRelativeAge, parsePrinter, printerBody, printerFormProblems, wasDeactivated, type PrinterForm, type PrinterRecord,
} from "@/features/printing/printers-rules";
import { displayServerMessage, fieldError } from "@/features/printing/server-errors";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";
import { apiErrorText } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";

type ActiveFilter = "all" | "true" | "false";

function PrinterDialog({ printer, onClose }: { printer: PrinterRecord | null; onClose: () => void }) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PrinterForm>(() => (printer ? formFromPrinter(printer) : EMPTY_PRINTER_FORM));
  const [showErrors, setShowErrors] = useState(false);
  const problems = printerFormProblems(form);
  const set = (patch: Partial<PrinterForm>) => setForm((current) => ({ ...current, ...patch }));

  const save = useMutation({
    mutationFn: async () => apiFetch(printer ? PRINTER_PATHS.one(printer.id) : PRINTER_PATHS.list, { method: printer ? "PATCH" : "POST", body: printerBody(form) }),
    onSuccess() {
      toast.success(t("common.success"));
      void queryClient.invalidateQueries({ queryKey: ["printers"] });
      onClose();
    },
    onError: (error) => { if (!fieldError(error, "name")) toast.error(apiErrorText(error, t)); },
  });
  const serverName = displayServerMessage(fieldError(save.error, "name"), locale, t("printers.form.nameTaken"));
  const nameMessage = showErrors && problems.name ? t(problems.name === "required" ? "printers.form.nameRequired" : "printers.form.tooLong", { max: PRINTER_NAME_MAX }) : serverName;

  function submit() {
    setShowErrors(true);
    if (Object.keys(problems).length) return;
    save.mutate();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader className="pe-10">
          <DialogTitle>{printer ? t("printers.edit") : t("printers.add")}</DialogTitle>
          <DialogDescription>{t("printers.form.hint")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submit(); }} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="printer-name">{t("printers.form.name")}</Label>
            <Input id="printer-name" autoFocus value={form.name} onChange={(event) => set({ name: event.target.value })} aria-invalid={Boolean(nameMessage)} aria-describedby="printer-name-help" className={cn("h-11", nameMessage && "border-destructive")} dir="auto" />
            {nameMessage ? <p id="printer-name-help" role="alert" className="text-xs font-medium text-destructive">{nameMessage}</p> : <p id="printer-name-help" className="text-xs text-muted-foreground">{t("printers.form.nameHint")}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="printer-station">{t("printers.form.station")} <span className="text-xs font-normal text-muted-foreground">({t("counter.optional")})</span></Label>
            <Input id="printer-station" value={form.station} onChange={(event) => set({ station: event.target.value })} aria-invalid={Boolean(showErrors && problems.station)} className="h-11" dir="auto" />
            {showErrors && problems.station ? <p role="alert" className="text-xs font-medium text-destructive">{t("printers.form.tooLong", { max: PRINTER_STATION_MAX })}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="printer-notes">{t("printers.form.notes")} <span className="text-xs font-normal text-muted-foreground">({t("counter.optional")})</span></Label>
            <Textarea id="printer-notes" rows={3} value={form.notes} onChange={(event) => set({ notes: event.target.value })} aria-invalid={Boolean(showErrors && problems.notes)} dir="auto" />
            {showErrors && problems.notes ? <p role="alert" className="text-xs font-medium text-destructive">{t("printers.form.tooLong", { max: PRINTER_NOTES_MAX })}</p> : null}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <Label htmlFor="printer-active" className="min-w-0">{t("printers.form.active")}<span className="block text-xs font-normal text-muted-foreground">{t("printers.form.activeHint")}</span></Label>
            <Switch id="printer-active" checked={form.isActive} onCheckedChange={(isActive) => set({ isActive, isDefault: isActive ? form.isDefault : false })} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <Label htmlFor="printer-default" className="min-w-0">{t("printers.form.default")}<span className="block text-xs font-normal text-muted-foreground">{t("printers.form.defaultHint")}</span></Label>
            <Switch id="printer-default" checked={form.isDefault} disabled={!form.isActive} onCheckedChange={(isDefault) => set({ isDefault })} />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={save.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone?: "danger" | "warn" }) {
  return (
    <div className={cn("min-w-14 rounded-lg bg-muted/40 px-2 py-1.5 text-center", value > 0 && tone === "danger" && "bg-red-500/10 text-red-700 dark:text-red-300", value > 0 && tone === "warn" && "bg-amber-500/10 text-amber-800 dark:text-amber-200")}>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-base font-black tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * The registry of printers the desktop print agent drives. A printer appears here by itself when its agent first reports in (it
 * names its printer in the heartbeat); staff can also add one by hand, rename it, mark the default, switch it off or delete it.
 * The list refreshes itself while the tab is visible.
 */
export function PrintersPanel() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [searchDraft, setSearchDraft] = useState("");
  const search = useDebouncedValue(searchDraft).trim();
  const [active, setActive] = useState<ActiveFilter>("all");
  const [editing, setEditing] = useState<PrinterRecord | "new" | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  // "Last seen 3 minutes ago" must age on screen even when the list has not changed.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);

  const query = useQuery({
    queryKey: ["printers", search, active],
    refetchInterval: PRINTER_REFRESH_MS,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (active !== "all") params.set("is_active", active);
      const collection = await normalizeCollection<unknown>(await apiFetch(`${PRINTER_PATHS.list}?${params}`));
      // The list is a plain array (not paginated).
      return { ...collection, results: collection.results.map(parsePrinter).filter((entry): entry is PrinterRecord => entry !== null) };
    },
  });
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["printers"] }); };

  const toggle = useMutation({
    mutationFn: async (input: { printer: PrinterRecord; isActive: boolean }) => {
      setBusy(input.printer.id);
      return apiFetch(PRINTER_PATHS.one(input.printer.id), { method: "PATCH", body: { is_active: input.isActive } });
    },
    onSuccess: refresh,
    onError: (error) => toast.error(apiErrorText(error, t)),
    onSettled: () => setBusy(null),
  });
  const remove = useMutation({
    mutationFn: async (printer: PrinterRecord) => {
      setBusy(printer.id);
      const response = await apiFetch(PRINTER_PATHS.one(printer.id), { method: "DELETE" });
      // 204 has no body; a 200 with PRINTER_DEACTIVATED means the printer had jobs and was only switched off.
      return response.status === 204 ? null : await response.json().catch(() => null);
    },
    onSuccess(payload) { toast.success(wasDeactivated(payload) ? t("printers.deactivated") : t("printers.removed")); refresh(); },
    onError: (error) => toast.error(apiErrorText(error, t)),
    onSettled: () => setBusy(null),
  });

  const printers = query.data?.results ?? [];
  const filtered = search !== "" || active !== "all";

  return (
    <div className="space-y-4">
      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl border p-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input className="ps-10" value={searchDraft} onChange={(event) => { setSearchDraft(event.target.value); }} placeholder={t("printers.search")} aria-label={t("common.search")} />
        </div>
        <Select value={active} onValueChange={(value) => { setActive(value as ActiveFilter); }}>
          <SelectTrigger className="w-40" aria-label={t("common.status")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("printers.filter.all")}</SelectItem>
            <SelectItem value="true">{t("printers.filter.active")}</SelectItem>
            <SelectItem value="false">{t("printers.filter.inactive")}</SelectItem>
          </SelectContent>
        </Select>
        <p className="ms-auto flex items-center gap-2 text-xs text-muted-foreground" role="status"><span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />{t("queue.live", { seconds: PRINTER_REFRESH_MS / 1000 })}</p>
        <Button variant="outline" onClick={() => query.refetch()}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />{t("common.refresh")}</Button>
        <Button onClick={() => setEditing("new")}><Plus />{t("printers.add")}</Button>
      </div>

      {query.isPending ? <Skeleton className="h-64 rounded-2xl" /> : query.isError ? <ErrorPanel error={query.error} retry={() => query.refetch()} /> : !printers.length ? (
        <div className="space-y-2 rounded-2xl border bg-card p-10 text-center">
          <PrinterIcon className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
          <h3 className="font-bold">{filtered ? t("printers.noMatches") : t("printers.emptyTitle")}</h3>
          {filtered ? null : <p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground">{t("printers.emptyBody")}</p>}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="p-3 text-start font-semibold">{t("printers.col.printer")}</th>
                  <th scope="col" className="p-3 text-start font-semibold">{t("printers.col.station")}</th>
                  <th scope="col" className="p-3 text-start font-semibold">{t("printers.col.connection")}</th>
                  <th scope="col" className="p-3 text-start font-semibold">{t("printers.col.jobs")}</th>
                  <th scope="col" className="p-3 text-start font-semibold">{t("printers.col.active")}</th>
                  <th scope="col" className="w-28 p-3 text-start font-semibold"><span className="sr-only">{t("common.actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {printers.map((printer) => {
                  const seen = formatRelativeAge(printer.last_seen_at, locale, now);
                  const working = busy === printer.id;
                  const agentState = printer.last_status === "idle" ? t("printers.agent.idle") : printer.last_status === "busy" ? t("printers.agent.busy") : printer.last_status === "error" ? t("printers.agent.error") : null;
                  return (
                    <tr key={printer.id} className={cn("border-t align-top hover:bg-muted/30", !printer.is_active && "text-muted-foreground")}>
                      <td className="min-w-[12rem] p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="break-words font-semibold" dir="auto">{printer.name}</span>
                          {printer.is_default ? <Badge variant="info" className="gap-1 rounded-full"><Star className="size-3" aria-hidden="true" />{t("printers.default")}</Badge> : null}
                        </div>
                        {printer.notes ? <p className="mt-1 max-w-[18rem] break-words text-xs text-muted-foreground" dir="auto">{printer.notes}</p> : null}
                      </td>
                      <td className="p-3" dir="auto">{printer.station || "—"}</td>
                      <td className="p-3">
                        <Badge variant={printer.online ? "success" : "outline"} className="gap-1.5 whitespace-nowrap rounded-full">
                          <span className={cn("size-1.5 rounded-full", printer.online ? "bg-emerald-500" : "bg-muted-foreground")} aria-hidden="true" />
                          {printer.online ? t("printers.online") : t("printers.offline")}
                        </Badge>
                        {agentState ? <p className="mt-1 text-xs"><span className={cn("font-semibold", printer.last_status === "error" && "text-destructive")}>{agentState}</span>{printer.last_detail ? <span className="text-muted-foreground" dir="auto"> · {printer.last_detail}</span> : null}</p> : null}
                        <p className="mt-1 text-xs text-muted-foreground"><bdi>{seen ? t("printers.lastSeen", { when: seen }) : t("printers.neverSeen")}</bdi></p>
                      </td>
                      <td className="p-3">
                        <dl className="flex gap-1.5">
                          <Counter label={t("printers.jobs.queued")} value={printer.jobs.queued} tone="warn" />
                          <Counter label={t("printers.jobs.printing")} value={printer.jobs.printing} />
                          <Counter label={t("printers.jobs.failed")} value={printer.jobs.failed_24h} tone="danger" />
                        </dl>
                      </td>
                      <td className="p-3">
                        <Switch checked={printer.is_active} disabled={working} aria-label={t("printers.toggle", { name: printer.name })} onCheckedChange={(isActive) => toggle.mutate({ printer, isActive })} />
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" aria-label={t("printers.editNamed", { name: printer.name })} onClick={() => setEditing(printer)}><Pencil /></Button>
                          <ConfirmDialog
                            trigger={<Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" disabled={working} aria-label={t("printers.deleteNamed", { name: printer.name })}><Trash2 /></Button>}
                            title={t("printers.deleteTitle", { name: printer.name })}
                            description={t("printers.deleteBody")}
                            confirmLabel={t("common.delete")}
                            cancelLabel={t("common.cancel")}
                            onConfirm={() => remove.mutate(printer)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="text-xs leading-5 text-muted-foreground">{t("printers.agentNote")}</p>

      {editing ? <PrinterDialog key={editing === "new" ? "new" : editing.id} printer={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
