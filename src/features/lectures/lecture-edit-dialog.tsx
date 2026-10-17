"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FacultySelect, useFaculties } from "@/features/lectures/lecture-faculty";
import { lectureErrorText } from "@/features/lectures/lecture-errors";
import { classifyLectureError, isGeneralLecture, type LectureRow } from "@/features/lectures/lecture-rules";
import { LECTURE_TITLE_MAX } from "@/features/lectures/lecture-upload";
import { useIdempotencyKey } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import { apiFetch } from "@/lib/api/browser-client";
import { payloadSignature } from "@/lib/api/idempotency";

/** Edits title and description, and the faculty of a general lecture (the file and the subject cannot be changed). */
export function LectureEditDialog({ lecture, onOpenChange, onSaved }: { lecture: LectureRow; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [title, setTitle] = useState(lecture.title);
  const [description, setDescription] = useState(lecture.description ?? "");
  const general = isGeneralLecture(lecture);
  const initialFaculty = lecture.faculty ? String(lecture.faculty) : "";
  const [faculty, setFaculty] = useState(initialFaculty);
  const faculties = useFaculties();
  const [clientError, setClientError] = useState<string | null>(null);
  const [noChanges, setNoChanges] = useState(false);
  const keys = useIdempotencyKey();

  const save = useMutation({
    mutationFn: (body: Record<string, string | number | null>) => apiFetch(`/api/v1/dashboard/lectures/${encodeURIComponent(String(lecture.id))}/`, { method: "PATCH", body, idempotencyKey: keys.get(payloadSignature("lecture-edit", lecture.id, body)) }),
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
  const facultyError = classified?.fields.faculty;
  const banner = save.error && classified && (classified.kind !== "fields" || Object.keys(classified.fields).some((name) => !["title", "description", "faculty"].includes(name))) ? lectureErrorText(save.error, t) : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (save.isPending) return;
    const nextTitle = title.trim();
    if (!nextTitle) { setClientError(t("validation.required")); setTimeout(() => document.getElementById("lecture-edit-title")?.focus(), 0); return; }
    if (nextTitle.length > LECTURE_TITLE_MAX) { setClientError(t("validation.maxLength", { n: LECTURE_TITLE_MAX })); return; }
    const body: Record<string, string | number | null> = {};
    if (nextTitle !== lecture.title) body.title = nextTitle;
    if (description.trim() !== (lecture.description ?? "").trim()) body.description = description.trim();
    // Only a general lecture can change faculty (null = all faculties); the backend rejects a faculty on a subject lecture.
    if (general && faculty !== initialFaculty) body.faculty = faculty ? Number(faculty) : null;
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
          {general ? (
            <div className="space-y-2">
              <Label htmlFor="lecture-edit-faculty">{t("lectures.edit.faculty")}</Label>
              <FacultySelect id="lecture-edit-faculty" value={faculty} allowAll faculties={faculties} disabled={save.isPending} invalid={Boolean(facultyError)} describedBy={facultyError ? "lecture-edit-faculty-error" : undefined} onChange={(next) => { setFaculty(next); setNoChanges(false); }} />
              <p className="text-xs text-muted-foreground">{t("lectures.edit.facultyHint")}</p>
              {facultyError ? <p id="lecture-edit-faculty-error" role="alert" className="text-xs font-medium text-destructive">{facultyError}</p> : null}
            </div>
          ) : null}
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
