"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { lectureErrorText } from "@/features/lectures/lecture-errors";
import { classifyLectureError, type LectureRow } from "@/features/lectures/lecture-rules";
import { LECTURE_TITLE_MAX } from "@/features/lectures/lecture-upload";
import { useIdempotencyKey } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import { apiFetch } from "@/lib/api/browser-client";
import { payloadSignature } from "@/lib/api/idempotency";

/** Edits title and description (the original file cannot be replaced; the subject is fixed by the duplicate rule). */
export function LectureEditDialog({ lecture, onOpenChange, onSaved }: { lecture: LectureRow; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [title, setTitle] = useState(lecture.title);
  const [description, setDescription] = useState(lecture.description ?? "");
  const [clientError, setClientError] = useState<string | null>(null);
  const [noChanges, setNoChanges] = useState(false);
  const keys = useIdempotencyKey();

  const save = useMutation({
    mutationFn: (body: Record<string, string>) => apiFetch(`/api/v1/dashboard/lectures/${encodeURIComponent(String(lecture.id))}/`, { method: "PATCH", body, idempotencyKey: keys.get(payloadSignature("lecture-edit", lecture.id, body)) }),
    onSuccess() {
      keys.reset();
      toast.success(t("lectures.done.edit"));
      onSaved();
      onOpenChange(false);
    },
  });

  const classified = save.error ? classifyLectureError(save.error) : null;
  const titleError = clientError ?? classified?.fields.title;
  const descriptionError = classified?.fields.description;
  const banner = save.error && classified && (classified.kind !== "fields" || Object.keys(classified.fields).some((name) => !["title", "description"].includes(name))) ? lectureErrorText(save.error, t) : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (save.isPending) return;
    const nextTitle = title.trim();
    if (!nextTitle) { setClientError(t("validation.required")); setTimeout(() => document.getElementById("lecture-edit-title")?.focus(), 0); return; }
    if (nextTitle.length > LECTURE_TITLE_MAX) { setClientError(t("validation.maxLength", { n: LECTURE_TITLE_MAX })); return; }
    const body: Record<string, string> = {};
    if (nextTitle !== lecture.title) body.title = nextTitle;
    if (description.trim() !== (lecture.description ?? "").trim()) body.description = description.trim();
    if (!Object.keys(body).length) { setNoChanges(true); return; }
    save.reset();
    save.mutate(body);
  };

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !save.isPending) onOpenChange(false); }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("lectures.edit.title")}</DialogTitle>
          <DialogDescription>{t("lectures.edit.hint")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate aria-busy={save.isPending || undefined} className="space-y-4">
          {banner ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{banner}</p> : null}
          <div className="space-y-2">
            <Label htmlFor="lecture-edit-title">{t("lectures.upload.titleField")}<span className="ms-1 text-destructive" aria-hidden="true">*</span></Label>
            <Input id="lecture-edit-title" value={title} maxLength={LECTURE_TITLE_MAX} disabled={save.isPending} aria-required aria-invalid={titleError ? true : undefined} aria-describedby={titleError ? "lecture-edit-title-error" : undefined} onChange={(event) => { setTitle(event.target.value); setClientError(null); setNoChanges(false); }} />
            {titleError ? <p id="lecture-edit-title-error" role="alert" className="text-xs font-medium text-destructive">{titleError}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lecture-edit-description">{t("lectures.upload.descriptionField")}</Label>
            <Textarea id="lecture-edit-description" rows={4} value={description} disabled={save.isPending} aria-invalid={descriptionError ? true : undefined} aria-describedby={descriptionError ? "lecture-edit-description-error" : undefined} onChange={(event) => { setDescription(event.target.value); setNoChanges(false); }} />
            {descriptionError ? <p id="lecture-edit-description-error" role="alert" className="text-xs font-medium text-destructive">{descriptionError}</p> : null}
          </div>
          {noChanges ? <p role="status" className="text-sm text-muted-foreground">{t("form.noChanges")}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>{t("common.cancel")}</Button>
            <Button type="submit" isLoading={save.isPending}>{t("common.save")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
