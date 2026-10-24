"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, RotateCw, Trash2, UploadCloud, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages";
import { apiFetch, apiUpload, normalizeCollection } from "@/lib/api/browser-client";
import { apiErrorText } from "@/lib/api/error-message";
import { newIdempotencyKey } from "@/lib/api/idempotency";
import { LIBRARY_POLICY, acceptAttribute, validateUpload } from "@/lib/uploads";
import { formatFileSize } from "@/lib/utils";

export interface VisibilityTemplate {
  id: number; name: string; visibility: string; university: number | null; faculty: number | null; major: number | null;
  academic_year: number | null; semester: number | null; subject: number | null; group: number | null; is_printable: boolean; is_active: boolean;
}

export function useVisibilityTemplates() {
  return useQuery({
    queryKey: ["file-visibility-templates"],
    queryFn: async () => normalizeCollection<VisibilityTemplate>(await apiFetch("/api/v1/dashboard/file-visibility-templates/?page_size=100")),
  });
}

type RowStatus = "queued" | "uploading" | "done" | "failed";
interface Row { id: string; file: File; title: string; status: RowStatus; progress: number; error: string | null; key: string }

const CONCURRENCY = 3;

/** "Hello_World-notes.pdf" -> "Hello World notes": a readable title taken from the file name. */
export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/u, "").replace(/[_-]+/gu, " ").replace(/\s+/gu, " ").trim();
  return (base || name).slice(0, 255);
}

/** Drag-and-drop several files, pick one saved audience (visibility template) for all of them, watch each upload, retry failures. */
export function BulkUploadDialog({ onClose }: { onClose: () => void }) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const templates = useVisibilityTemplates();
  const active = (templates.data?.results ?? []).filter((template) => template.is_active);
  const [templateId, setTemplateId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const chosen = active.find((template) => String(template.id) === templateId);

  const patch = useCallback((id: string, change: Partial<Row>) => setRows((current) => current.map((row) => (row.id === id ? { ...row, ...change } : row))), []);

  const add = (files: FileList | File[]) => {
    const next: Row[] = [];
    for (const file of Array.from(files)) {
      const problem = validateUpload(file, LIBRARY_POLICY);
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        file, title: titleFromFileName(file.name), key: newIdempotencyKey(),
        status: problem ? "failed" : "queued", progress: 0,
        error: problem ? t(`files.bulk.problem.${problem}` as MessageKey) : null,
      });
    }
    setRows((current) => [...current, ...next]);
  };

  const body = (row: Row, template: VisibilityTemplate) => {
    const form = new FormData();
    form.append("title", row.title.trim() || titleFromFileName(row.file.name));
    form.append("file", row.file);
    form.append("visibility", template.visibility);
    form.append("is_printable", String(template.is_printable));
    form.append("is_active", "true");
    for (const field of ["university", "faculty", "major", "academic_year", "semester", "subject", "group"] as const) {
      const value = template[field];
      if (value !== null) form.append(field, String(value));
    }
    return form;
  };

  const uploadOne = async (row: Row, template: VisibilityTemplate) => {
    patch(row.id, { status: "uploading", progress: 0, error: null });
    try {
      await apiUpload("/api/v1/dashboard/files/", body(row, template), { idempotencyKey: row.key, onProgress: (loaded, total) => patch(row.id, { progress: total ? loaded / total : 0 }) });
      patch(row.id, { status: "done", progress: 1 });
    } catch (failure) {
      // A definitive refusal may be cached against the key: the retry needs a new one.
      patch(row.id, { status: "failed", error: apiErrorText(failure, t), key: newIdempotencyKey() });
    }
  };

  const run = async (only?: string) => {
    if (!chosen || running) return;
    setRunning(true);
    const queue = rows.filter((row) => (only ? row.id === only : row.status === "queued" || (row.status === "failed" && row.file.size > 0 && !validateUpload(row.file, LIBRARY_POLICY))));
    let index = 0;
    const worker = async () => { while (index < queue.length) { const row = queue[index++]; if (row) await uploadOne(row, chosen); } };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    setRunning(false);
    await queryClient.invalidateQueries({ queryKey: ["resource", "files"] });
  };

  const drop = (event: DragEvent) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length) add(event.dataTransfer.files); };
  const waiting = rows.filter((row) => row.status === "queued").length;
  const failed = rows.filter((row) => row.status === "failed").length;
  const done = rows.filter((row) => row.status === "done").length;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !running) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{t("files.bulk.title")}</DialogTitle><DialogDescription>{t("files.bulk.hint")}</DialogDescription></DialogHeader>
        <div className="space-y-2">
          <Label>{t("files.bulk.template")}</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger><SelectValue placeholder={t("files.bulk.pickTemplate")} /></SelectTrigger>
            <SelectContent>{active.map((template) => <SelectItem key={template.id} value={String(template.id)}>{template.name}</SelectItem>)}</SelectContent>
          </Select>
          {active.length === 0 && !templates.isLoading ? <p className="text-xs text-muted-foreground">{t("files.bulk.noTemplates")} <Link className="text-primary underline" href={`/${locale}/dashboard/files/templates`}>{t("files.bulk.createTemplate")}</Link></p> : null}
        </div>
        <div
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}
          className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center text-sm ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30"}`}
        >
          <UploadCloud className="size-8 text-muted-foreground" />
          <p>{t("files.bulk.drop")}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>{t("files.bulk.choose")}</Button>
          <Input ref={input} type="file" multiple className="hidden" accept={acceptAttribute(LIBRARY_POLICY)} onChange={(event) => { if (event.target.files) add(event.target.files); event.target.value = ""; }} />
        </div>
        {rows.length > 0 ? (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {rows.map((row) => (
              <li key={row.id} className="rounded-lg border p-2 text-sm">
                <div className="flex items-center gap-2">
                  {row.status === "done" ? <CheckCircle2 className="size-4 text-emerald-600" /> : row.status === "failed" ? <XCircle className="size-4 text-destructive" /> : null}
                  <Input aria-label={t("files.bulk.fileTitle")} className="h-8 flex-1" value={row.title} maxLength={255} disabled={row.status === "uploading" || row.status === "done"} onChange={(event) => patch(row.id, { title: event.target.value })} />
                  <span className="whitespace-nowrap text-xs text-muted-foreground" dir="ltr">{formatFileSize(row.file.size, locale)}</span>
                  {row.status === "failed" && !validateUpload(row.file, LIBRARY_POLICY) ? <Button size="icon" variant="ghost" aria-label={t("files.bulk.retry")} disabled={!chosen || running} onClick={() => void run(row.id)}><RotateCw className="size-4" /></Button> : null}
                  {row.status !== "uploading" && row.status !== "done" ? <Button size="icon" variant="ghost" aria-label={t("common.delete")} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}><Trash2 className="size-4" /></Button> : null}
                </div>
                {row.status === "uploading" ? <div className="mt-2 h-1.5 overflow-hidden rounded bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(row.progress * 100)}%` }} /></div> : null}
                {row.error ? <p role="alert" className="mt-1 text-xs text-destructive">{row.error}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">{t("files.bulk.summary", { done, waiting, failed })}</span>
          <span className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={running}>{t("common.close")}</Button>
            <Button type="button" disabled={!chosen || running || (waiting === 0 && failed === 0)} isLoading={running} onClick={() => void run()}>{t("files.bulk.start")}</Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
