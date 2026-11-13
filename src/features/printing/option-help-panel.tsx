"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, ImagePlus, ImageOff, Info, Pencil, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  BODY_MAX, CAPTION_MAX, FIXED_TOPICS, IMAGE_MAX_BYTES, KEY_MAX, KNOWN_EXTRA_SECTIONS, OPTION_HELP_PATH, SORT_MAX, TITLE_MAX,
  bodyGuidance, emptyForm, extraSectionLabelKey, filterRows, formFromRow, groupByTopic, groupLabelKey, groupOfTopic, helpFields, helpProblems,
  imageProblem, isExtraTopic, isStatusFilter, keyHints, missingKeys, multipartEntries, optionHelpPath, parseOptionHelp, previewParagraphs, topicChoices,
  EXTRA_GROUP, EXTRA_TOPIC_PREFIX,
  type HelpForm, type HelpGroupId, type HelpProblem, type HelpProblems, type ImageChange, type OptionHelpRow, type StatusFilter,
} from "@/features/printing/option-help-rules";
import { Field } from "@/features/printing/segmented";
import { displayServerMessage, fieldError } from "@/features/printing/server-errors";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";
import { apiErrorText } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";

const QUERY_KEY = ["print-option-help"] as const;
const TOPIC_KEY = "__topic__";
const CUSTOM_KEY = "__custom__";

type T = ReturnType<typeof useI18n>["t"];

function useOptionHelp() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const collection = await normalizeCollection<unknown>(await apiFetch(OPTION_HELP_PATH));
      return collection.results.map(parseOptionHelp).flatMap((row) => (row ? [row] : []));
    },
  });
}

/** Name of a topic as the staff reads it; a section of the paper options is shown as «group · section». */
function useTopicLabel() {
  const { t } = useI18n();
  return (topic: string): string => {
    const group = groupOfTopic(topic);
    if (!group) return topic;
    if (group !== EXTRA_GROUP) return t(groupLabelKey(group));
    const sectionKey = extraSectionLabelKey(topic);
    return `${t(groupLabelKey(EXTRA_GROUP))} · ${sectionKey ? t(sectionKey) : topic.slice(EXTRA_TOPIC_PREFIX.length)}`;
  };
}

/** What a student will see: the bottom sheet of the app, drawn in the brand colours. */
export function SheetPreview({ title, body, imageUrl, caption, inactive }: { title: string; body: string; imageUrl: string | null; caption: string; inactive?: boolean }) {
  const { t } = useI18n();
  const paragraphs = previewParagraphs(body);
  const empty = !title.trim() && !body.trim();
  return (
    <figure aria-label={t("help.preview.title")} className="mx-auto w-full max-w-[22rem] space-y-2">
      <div className="relative overflow-hidden rounded-[2rem] border-4 border-foreground/80 bg-gradient-to-b from-primary/20 to-primary/5 p-0 pt-14 shadow-lg">
        <div className="absolute inset-x-0 top-0 h-14 bg-foreground/10" aria-hidden="true" />
        <div className="relative rounded-t-3xl bg-card px-5 pb-6 pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted-foreground/30" aria-hidden="true" />
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden="true"><Info className="size-5" /></span>
            <h4 className="min-w-0 flex-1 break-words text-lg font-black leading-7" dir="auto">{title.trim() || t("help.preview.sampleTitle")}</h4>
          </div>
          {imageUrl ? (
            <div className="mt-4 overflow-hidden rounded-2xl border bg-muted/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt={caption.trim() || title.trim() || t("help.preview.imageAlt")} className="max-h-56 w-full object-cover" />
              {caption.trim() ? <figcaption className="px-3 py-2 text-xs leading-5 text-muted-foreground" dir="auto">{caption.trim()}</figcaption> : null}
            </div>
          ) : null}
          <div className={cn("mt-4 space-y-2.5 text-sm leading-7 text-foreground/90", empty && "text-muted-foreground")} dir="auto">
            {paragraphs.length ? paragraphs.map((line, index) => <p key={index} className="break-words">{line}</p>) : <p>{t("help.preview.sampleBody")}</p>}
          </div>
          <div className="mt-5 grid h-11 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">{t("help.preview.gotIt")}</div>
        </div>
      </div>
      <figcaption className="text-center text-xs text-muted-foreground">{inactive ? t("help.preview.inactive") : t("help.preview.hint")}</figcaption>
    </figure>
  );
}

function problemText(problem: HelpProblem | undefined, t: T, max?: number): string | null {
  if (!problem) return null;
  if (problem === "required") return t("help.problem.required");
  if (problem === "tooLong") return t("help.problem.tooLong", { max: max ?? 0 });
  if (problem === "format") return t("help.problem.keyFormat");
  return t("help.problem.invalid");
}

function ImagePicker({ existingUrl, change, onChange }: { existingUrl: string | null; change: ImageChange; onChange: (change: ImageChange) => void }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const hasImage = change.kind === "replace" || (change.kind === "keep" && existingUrl !== null);

  function pick(file: File | undefined) {
    if (!file) return;
    const problem = imageProblem(file);
    if (problem) { setError(t(problem === "type" ? "help.form.imageType" : "help.form.imageSize", { max: IMAGE_MAX_BYTES / 1024 / 1024 })); return; }
    setError(null);
    onChange({ kind: "replace", file });
  }

  return (
    <div className="space-y-2">
      <input ref={input} id="help-image" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { pick(event.target.files?.[0]); event.target.value = ""; }} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
          <ImagePlus />{hasImage ? t("help.form.imageReplace") : t("help.form.imagePick")}
        </Button>
        {hasImage ? <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onChange({ kind: "remove" })}><X />{t("help.form.imageRemove")}</Button> : null}
        {change.kind !== "keep" && (existingUrl !== null || change.kind === "replace") ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => { setError(null); onChange({ kind: "keep" }); }}><RotateCcw />{t("help.form.imageUndo")}</Button>
        ) : null}
      </div>
      {error ? <p role="alert" className="text-xs font-medium text-destructive">{error}</p> : <p className="text-xs leading-5 text-muted-foreground">{t("help.form.imageHint", { max: IMAGE_MAX_BYTES / 1024 / 1024 })}</p>}
    </div>
  );
}

function HelpDialog({ row, rows, defaultTopic, onClose }: { row: OptionHelpRow | null; rows: readonly OptionHelpRow[]; defaultTopic: string; onClose: () => void }) {
  const { t, locale } = useI18n();
  const topicLabel = useTopicLabel();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<HelpForm>(() => (row ? formFromRow(row) : emptyForm(defaultTopic)));
  const [image, setImage] = useState<ImageChange>({ kind: "keep" });
  const [customKey, setCustomKey] = useState(() => (row ? row.key !== "" && !keyHints(row.topic).includes(row.key) : false));
  const [showErrors, setShowErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const set = (patch: Partial<HelpForm>) => { setServerErrors({}); setForm((current) => ({ ...current, ...patch })); };
  const problems: HelpProblems = helpProblems(form, rows, row?.id ?? null);
  const guidance = bodyGuidance(form.body);
  const hints = keyHints(form.topic);
  const gaps = missingKeys(form.topic, rows);
  const topics = useMemo(() => {
    const all = topicChoices();
    // An entry filed under a topic outside the known list (added by the server or another tool) stays editable.
    return row && !all.includes(row.topic) ? [row.topic, ...all] : all;
  }, [row]);

  // The picked file is shown from a temporary address that is released when it is replaced or the dialog closes.
  const pickedUrl = useMemo(() => (image.kind === "replace" ? URL.createObjectURL(image.file) : null), [image]);
  useEffect(() => () => { if (pickedUrl) URL.revokeObjectURL(pickedUrl); }, [pickedUrl]);
  const shownImage = image.kind === "replace" ? pickedUrl : image.kind === "keep" ? row?.imageUrl ?? null : null;

  const save = useMutation({
    mutationFn: async () => {
      const entries = multipartEntries(form, image);
      let body: unknown = helpFields(form);
      if (entries) {
        const data = new FormData();
        for (const [name, value] of entries) data.append(name, value);
        body = data;
      }
      await apiFetch(row ? optionHelpPath(row.id) : OPTION_HELP_PATH, { method: row ? "PATCH" : "POST", body });
    },
    onSuccess() { toast.success(t("help.saved")); void queryClient.invalidateQueries({ queryKey: QUERY_KEY }); onClose(); },
    onError(error) {
      const found: Record<string, string> = {};
      for (const field of ["topic", "key", "title", "body", "image", "image_caption", "sort_order"]) {
        const message = displayServerMessage(fieldError(error, field), locale, t("help.problem.server"));
        if (message) found[field] = message;
      }
      setServerErrors(found);
      toast.error(apiErrorText(error, t));
    },
  });

  function submit() {
    setShowErrors(true);
    if (Object.keys(problems).length) return;
    save.mutate();
  }

  const show = showErrors;
  const keyError = (show && problemText(problems.key, t, KEY_MAX)) || (show && problems.duplicate ? t("help.problem.duplicate") : null) || serverErrors.key || null;
  const titleError = (show && problemText(problems.title, t, TITLE_MAX)) || serverErrors.title || null;
  const bodyError = (show && problemText(problems.body, t, BODY_MAX)) || serverErrors.body || null;
  const captionError = (show && problemText(problems.imageCaption, t, CAPTION_MAX)) || serverErrors.image_caption || null;
  const sortError = (show && problemText(problems.sortOrder, t)) || serverErrors.sort_order || null;
  const keyChoice = form.key === "" && !customKey ? TOPIC_KEY : customKey ? CUSTOM_KEY : form.key;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader className="pe-10">
          <DialogTitle>{row ? t("help.edit") : t("help.add")}</DialogTitle>
          <DialogDescription>{t("help.form.intro")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <form className="min-w-0 space-y-4" onSubmit={(event) => { event.preventDefault(); submit(); }} noValidate>
            <Field label={t("help.form.topic")} htmlFor="help-topic" hint={t("help.form.topicHint")} error={serverErrors.topic ?? null}>
              <Select value={form.topic} onValueChange={(topic) => { setCustomKey(false); set({ topic, key: "" }); }}>
                <SelectTrigger id="help-topic" className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{topics.map((topic) => <SelectItem key={topic} value={topic}>{topicLabel(topic)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            {hints.length ? (
              <Field label={t("help.form.key")} htmlFor="help-key" hint={t("help.form.keyHint")} error={keyError}>
                <Select value={keyChoice} onValueChange={(value) => {
                  if (value === CUSTOM_KEY) { setCustomKey(true); set({ key: "" }); } else { setCustomKey(false); set({ key: value === TOPIC_KEY ? "" : value }); }
                }}>
                  <SelectTrigger id="help-key" className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TOPIC_KEY}>{t("help.form.keyTopic")}</SelectItem>
                    {hints.map((code) => <SelectItem key={code} value={code}><bdi dir="ltr">{code}</bdi></SelectItem>)}
                    <SelectItem value={CUSTOM_KEY}>{t("help.form.keyCustom")}</SelectItem>
                  </SelectContent>
                </Select>
                {customKey ? <Input aria-label={t("help.form.key")} value={form.key} onChange={(event) => set({ key: event.target.value.trim() })} maxLength={KEY_MAX} dir="ltr" className="mt-2 h-11" aria-invalid={Boolean(keyError)} /> : null}
              </Field>
            ) : (
              <Field label={t("help.form.key")} htmlFor="help-key" optional={t("counter.optional")} hint={isExtraTopic(form.topic) ? t("help.form.keyHintExtra") : t("help.form.keyHintFree")} error={keyError}>
                <Input id="help-key" value={form.key} onChange={(event) => set({ key: event.target.value.trim() })} maxLength={KEY_MAX} dir="ltr" className={cn("h-11", keyError && "border-destructive")} aria-invalid={Boolean(keyError)} />
              </Field>
            )}
            {gaps.length ? <p className="rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">{t("help.form.gaps")} <bdi dir="ltr" className="font-semibold">{gaps.join(", ")}</bdi></p> : null}
            <Field label={t("help.form.title")} htmlFor="help-title" error={titleError}>
              <Input id="help-title" autoFocus value={form.title} onChange={(event) => set({ title: event.target.value })} maxLength={TITLE_MAX + 20} dir="auto" className={cn("h-11", titleError && "border-destructive")} aria-invalid={Boolean(titleError)} />
            </Field>
            <Field label={t("help.form.body")} htmlFor="help-body" hint={t("help.form.bodyHint")} error={bodyError}>
              <Textarea id="help-body" rows={8} value={form.body} onChange={(event) => set({ body: event.target.value })} dir="auto" className={cn("leading-7", bodyError && "border-destructive")} aria-invalid={Boolean(bodyError)} />
              <p className={cn("text-xs tabular-nums", guidance.level === "ok" && "text-muted-foreground", guidance.level === "near" && "text-amber-700 dark:text-amber-300", guidance.level === "over" && "font-semibold text-destructive")} role="status">
                {t("help.form.bodyCount", { length: guidance.length, max: BODY_MAX })}
                {guidance.level === "near" ? ` · ${t("help.form.bodyNear", { left: guidance.remaining })}` : ""}
                {guidance.level === "over" ? ` · ${t("help.form.bodyOver", { over: -guidance.remaining })}` : ""}
              </p>
            </Field>
            <Field label={t("help.form.image")} htmlFor="help-image" optional={t("counter.optional")}>
              <ImagePicker existingUrl={row?.imageUrl ?? null} change={image} onChange={setImage} />
              {serverErrors.image ? <p role="alert" className="text-xs font-medium text-destructive">{serverErrors.image}</p> : null}
            </Field>
            {shownImage ? (
              <Field label={t("help.form.caption")} htmlFor="help-caption" optional={t("counter.optional")} error={captionError}>
                <Input id="help-caption" value={form.imageCaption} onChange={(event) => set({ imageCaption: event.target.value })} dir="auto" className="h-11" aria-invalid={Boolean(captionError)} />
              </Field>
            ) : null}
            <Field label={t("help.form.sort")} htmlFor="help-sort" hint={t("help.form.sortHint", { max: SORT_MAX })} error={sortError}>
              <Input id="help-sort" inputMode="numeric" dir="ltr" value={form.sortOrder} onChange={(event) => set({ sortOrder: event.target.value.replace(/\D/gu, "").slice(0, 5) })} className="h-11 w-28 tabular-nums" aria-invalid={Boolean(sortError)} />
            </Field>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <label htmlFor="help-active" className="min-w-0 text-sm font-semibold">{t("help.form.active")}<span className="block text-xs font-normal text-muted-foreground">{t("help.form.activeHint")}</span></label>
              <Switch id="help-active" checked={form.isActive} onCheckedChange={(isActive) => set({ isActive })} />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={save.isPending}>{t("common.save")}</Button>
            </DialogFooter>
          </form>
          <aside className="min-w-0 lg:sticky lg:top-0 lg:self-start" aria-label={t("help.preview.title")}>
            <p className="mb-3 text-sm font-bold">{t("help.preview.title")}</p>
            <SheetPreview title={form.title} body={form.body} imageUrl={shownImage} caption={form.imageCaption} inactive={!form.isActive} />
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Thumb({ row }: { row: OptionHelpRow }) {
  return (
    <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted/40 text-muted-foreground" aria-hidden="true">
      {row.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
      ) : <ImageOff className="size-5" />}
    </span>
  );
}

function HelpRowItem({ row, selected, busy, onSelect, onPreview, onEdit, onToggle, onDelete }: {
  row: OptionHelpRow; selected: boolean; busy: boolean;
  onSelect: () => void; onPreview: () => void; onEdit: () => void; onToggle: (isActive: boolean) => void; onDelete: () => void;
}) {
  const { t } = useI18n();
  const topicLabel = useTopicLabel();
  const extra = row.topic.startsWith(EXTRA_TOPIC_PREFIX);
  return (
    <li className={cn("flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 transition-colors", selected && "border-primary/60 bg-primary/5", !row.isActive && "opacity-80")}>
      <button type="button" onClick={onSelect} aria-pressed={selected} className="flex min-w-0 flex-1 basis-60 items-center gap-3 rounded-lg text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Thumb row={row} />
        <span className="min-w-0">
          <span className="block break-words text-sm font-bold" dir="auto">{row.title || "—"}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {row.key ? <span>{t("help.scope.key")} <bdi dir="ltr" className="font-semibold text-foreground/80">{row.key}</bdi></span> : <span>{t("help.scope.topic")}</span>}
            {extra ? <span>· {topicLabel(row.topic)}</span> : null}
          </span>
        </span>
      </button>
      <div className="flex items-center gap-2">
        <Badge variant={row.isActive ? "success" : "outline"} className="whitespace-nowrap rounded-full">{row.isActive ? t("common.active") : t("common.inactive")}</Badge>
        <Switch checked={row.isActive} disabled={busy} aria-label={`${t("help.form.active")}: ${row.title}`} onCheckedChange={onToggle} />
        <Button type="button" variant="ghost" size="icon" className="size-9 lg:hidden" aria-label={`${t("help.preview.open")}: ${row.title}`} onClick={onPreview}><Eye className="size-4" /></Button>
        <Button type="button" variant="ghost" size="icon" className="size-9" aria-label={`${t("common.edit")}: ${row.title}`} onClick={onEdit}><Pencil className="size-4" /></Button>
        <ConfirmDialog
          trigger={<Button type="button" variant="ghost" size="icon" className="size-9 text-destructive hover:text-destructive" aria-label={`${t("common.delete")}: ${row.title}`} disabled={busy}><Trash2 className="size-4" /></Button>}
          title={t("help.deleteTitle")} description={t("help.deleteBody", { name: row.title })} confirmLabel={t("common.delete")} cancelLabel={t("common.cancel")} onConfirm={onDelete}
        />
      </div>
    </li>
  );
}

/** «شرح خيارات الطباعة»: the owner's explanations of each print option, shown to students in a sheet next to the option. */
export function OptionHelpPanel() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const help = useOptionHelp();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [group, setGroup] = useState<HelpGroupId | "all">("all");
  const [editing, setEditing] = useState<{ row: OptionHelpRow | null; topic: string } | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState<OptionHelpRow | null>(null);
  const topicLabel = useTopicLabel();
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: QUERY_KEY }); };

  const rows = useMemo(() => help.data ?? [], [help.data]);
  const visible = useMemo(() => filterRows(rows, { query, status, group }), [rows, query, status, group]);
  const groups = useMemo(() => groupByTopic(visible), [visible]);
  const selected = visible.find((row) => row.id === selectedId) ?? groups[0]?.rows[0] ?? null;
  const filtered = query.trim() !== "" || status !== "all" || group !== "all";

  const toggle = useMutation({
    mutationFn: async (input: { row: OptionHelpRow; isActive: boolean }) => {
      setBusyId(input.row.id);
      await apiFetch(optionHelpPath(input.row.id), { method: "PATCH", body: { is_active: input.isActive } });
    },
    onError: (error) => toast.error(apiErrorText(error, t)),
    onSettled: () => { setBusyId(null); refresh(); },
  });
  const remove = useMutation({
    mutationFn: async (row: OptionHelpRow) => {
      setBusyId(row.id);
      await apiFetch(optionHelpPath(row.id), { method: "DELETE" });
    },
    onSuccess: () => toast.success(t("help.removed")),
    onError: (error) => toast.error(apiErrorText(error, t)),
    onSettled: () => { setBusyId(null); refresh(); },
  });

  if (help.isPending) return <Skeleton className="h-72 rounded-2xl" />;
  if (help.isError) return <ErrorPanel error={help.error} retry={() => help.refetch()} />;

  const defaultTopic = group !== "all" && group !== EXTRA_GROUP ? group : FIXED_TOPICS[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-black">{t("help.title")}</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t("help.subtitle")}</p>
        </div>
        <Button type="button" onClick={() => setEditing({ row: null, topic: defaultTopic })}><Plus />{t("help.add")}</Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem_14rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("help.search")} aria-label={t("help.search")} className="h-11 ps-9" dir="auto" />
        </div>
        <Select value={status} onValueChange={(value) => { if (isStatusFilter(value)) setStatus(value); }}>
          <SelectTrigger className="h-11" aria-label={t("help.filter.status")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("help.filter.anyStatus")}</SelectItem>
            <SelectItem value="active">{t("common.active")}</SelectItem>
            <SelectItem value="inactive">{t("common.inactive")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={group} onValueChange={(value) => setGroup(value as HelpGroupId | "all")}>
          <SelectTrigger className="h-11" aria-label={t("help.filter.group")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("help.filter.anyGroup")}</SelectItem>
            {([...FIXED_TOPICS, EXTRA_GROUP] as HelpGroupId[]).map((id) => <SelectItem key={id} value={id}>{t(groupLabelKey(id))}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <p className="text-sm leading-6 text-muted-foreground">{t("help.empty.all")}</p>
          <Button type="button" className="mt-4" onClick={() => setEditing({ row: null, topic: defaultTopic })}><Plus />{t("help.add")}</Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("help.empty.filtered")}</p>
          {filtered ? <Button type="button" variant="outline" className="mt-4" onClick={() => { setQuery(""); setStatus("all"); setGroup("all"); }}>{t("help.clearFilters")}</Button> : null}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-5">
            {groups.map((item) => (
              <section key={item.id} aria-labelledby={`help-group-${item.id}`} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 id={`help-group-${item.id}`} className="text-sm font-black">{t(groupLabelKey(item.id))} <span className="font-normal text-muted-foreground">({item.rows.length})</span></h3>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing({ row: null, topic: item.id === EXTRA_GROUP ? `${EXTRA_TOPIC_PREFIX}${KNOWN_EXTRA_SECTIONS[0]}` : item.id })}><Plus />{t("help.add")}</Button>
                </div>
                <ul className="space-y-2">
                  {item.rows.map((row) => (
                    <HelpRowItem
                      key={row.id} row={row} selected={selected?.id === row.id} busy={busyId === row.id}
                      onSelect={() => setSelectedId(row.id)} onPreview={() => setPreviewing(row)} onEdit={() => setEditing({ row, topic: row.topic })}
                      onToggle={(isActive) => toggle.mutate({ row, isActive })} onDelete={() => remove.mutate(row)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <aside className="hidden min-w-0 lg:block" aria-label={t("help.preview.title")}>
            <div className="sticky top-4 space-y-3">
              <div>
                <p className="text-sm font-bold">{t("help.preview.title")}</p>
                {selected ? <p className="text-xs text-muted-foreground">{topicLabel(selected.topic)}</p> : null}
              </div>
              {selected ? <SheetPreview title={selected.title} body={selected.body} imageUrl={selected.imageUrl} caption={selected.imageCaption} inactive={!selected.isActive} /> : null}
            </div>
          </aside>
        </div>
      )}
      <Dialog open={previewing !== null} onOpenChange={(open) => { if (!open) setPreviewing(null); }}>
        <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
          <DialogHeader className="pe-10"><DialogTitle>{t("help.preview.title")}</DialogTitle><DialogDescription>{previewing ? topicLabel(previewing.topic) : ""}</DialogDescription></DialogHeader>
          {previewing ? <SheetPreview title={previewing.title} body={previewing.body} imageUrl={previewing.imageUrl} caption={previewing.imageCaption} inactive={!previewing.isActive} /> : null}
        </DialogContent>
      </Dialog>
      {editing ? <HelpDialog key={editing.row?.id ?? `new-${editing.topic}`} row={editing.row} rows={rows} defaultTopic={editing.topic} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
