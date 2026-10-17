"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { fetchAllPages, relationLabel } from "@/components/forms/contract-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FacultySelect, useFaculties } from "@/features/lectures/lecture-faculty";
import { lectureErrorText } from "@/features/lectures/lecture-errors";
import { classifyLectureError } from "@/features/lectures/lecture-rules";
import {
  buildLectureFormData, lectureFileMessage, LECTURE_TITLE_MAX, progressPercent, validateLectureForm,
  type FormMessage, type LectureFormErrors, type LectureKind,
} from "@/features/lectures/lecture-upload";
import { useIdempotencyKey } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import { apiUpload } from "@/lib/api/browser-client";
import { payloadSignature } from "@/lib/api/idempotency";
import { acceptAttribute, effectiveMaxBytes, LECTURE_POLICY } from "@/lib/uploads";
import { cn } from "@/lib/utils";

export const SUBJECTS_ENDPOINT = "/api/v1/dashboard/subjects/";
const LECTURES_ENDPOINT = "/api/v1/dashboard/lectures/";

/** Upload form for a new lecture: validates client-side, sends one multipart request with real progress, can be cancelled. */
export function LectureUploadDialog({ onOpenChange, onUploaded }: { onOpenChange: (open: boolean) => void; onUploaded: () => void }) {
  const { t } = useI18n();
  const [kind, setKind] = useState<LectureKind>("subject");
  const [facultyFilter, setFacultyFilter] = useState("");
  const [subject, setSubject] = useState("");
  const [generalFaculty, setGeneralFaculty] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<LectureFormErrors>({});
  const [percent, setPercent] = useState(0);
  const [announced, setAnnounced] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const keys = useIdempotencyKey();

  const subjects = useQuery({ queryKey: ["reference-options", SUBJECTS_ENDPOINT], queryFn: () => fetchAllPages(SUBJECTS_ENDPOINT), staleTime: 60_000 });
  const faculties = useFaculties();
  const visibleSubjects = useMemo(
    () => (subjects.data ?? []).filter((item) => !facultyFilter || String(item.faculty) === facultyFilter),
    [subjects.data, facultyFilter],
  );

  const upload = useMutation({
    mutationFn: async (values: { kind: LectureKind; subject: string; faculty: string; title: string; description: string; file: File }) => {
      const controller = new AbortController();
      abortRef.current = controller;
      return apiUpload(LECTURES_ENDPOINT, buildLectureFormData(values), {
        signal: controller.signal,
        idempotencyKey: keys.get(payloadSignature("lecture-upload", values.kind, values.subject, values.faculty, values.title, values.description, values.file.name, values.file.size, values.file.lastModified)),
        onProgress: (loaded, total) => {
          const next = progressPercent(loaded, total);
          setPercent(next);
          // Screen readers hear 25 % steps, not every progress event.
          setAnnounced(t("lectures.upload.progress", { percent: Math.floor(next / 25) * 25 }));
        },
      });
    },
    onSuccess() {
      keys.reset();
      toast.success(t("lectures.upload.success"));
      onUploaded();
      onOpenChange(false);
    },
    onError(error) {
      abortRef.current = null;
      if (error instanceof DOMException && error.name === "AbortError") {
        setCancelled(true);
        setAnnounced(t("lectures.upload.cancelled"));
        return;
      }
      if (classifyLectureError(error, "upload").kind === "duplicate") keys.reset();
    },
  });

  const pending = upload.isPending;
  const sentAll = pending && percent >= 100;
  const classified = upload.error && !cancelled ? classifyLectureError(upload.error, "upload") : null;

  const message = (item: FormMessage | undefined) => (item ? t(item.key, item.values) : undefined);
  // Server-side field errors (400) are shown inline on the field they name; a duplicate file is shown on the file field.
  const serverField = (name: string): string | undefined => {
    if (!classified) return undefined;
    if (name === "original_file" && classified.kind === "duplicate") return t("lectures.error.duplicate");
    return classified.fields[name];
  };
  const fieldError = {
    subject: message(errors.subject) ?? serverField("subject"),
    title: message(errors.title) ?? serverField("title"),
    description: serverField("description"),
    faculty: serverField("faculty"),
    file: message(errors.file) ?? serverField("original_file"),
  };
  const bannerText = upload.error && !cancelled && (!classified || !["duplicate", "fields"].includes(classified.kind) || (classified.kind === "fields" && Object.keys(classified.fields).some((name) => !["subject", "faculty", "title", "description", "original_file"].includes(name))))
    ? lectureErrorText(upload.error, t, "upload")
    : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const problems = validateLectureForm({ kind, subject, faculty: generalFaculty, title, description, file });
    setErrors(problems);
    if (Object.keys(problems).length || !file) {
      const first = (["subject", "title", "file"] as const).find((name) => problems[name]);
      if (first) setTimeout(() => document.getElementById(`lecture-${first}`)?.focus(), 0);
      return;
    }
    setPercent(0);
    setCancelled(false);
    upload.reset();
    upload.mutate({ kind, subject, faculty: generalFaculty, title: title.trim(), description: description.trim(), file });
  };

  const clearError = (name: keyof LectureFormErrors) => { setErrors((current) => ({ ...current, [name]: undefined })); setCancelled(false); };
  const describedBy = (name: string, hint?: boolean) => [fieldError[name as keyof typeof fieldError] ? `lecture-${name}-error` : null, hint ? `lecture-${name}-hint` : null].filter(Boolean).join(" ") || undefined;
  const errorLine = (name: keyof typeof fieldError) => fieldError[name] ? <p id={`lecture-${name}-error`} role="alert" className="text-xs font-medium text-destructive">{fieldError[name]}</p> : null;

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !pending) onOpenChange(false); }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto" onInteractOutside={(event) => { if (pending) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{t("lectures.upload.title")}</DialogTitle>
          <DialogDescription>{t("lectures.upload.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate aria-busy={pending || undefined} className="space-y-4">
          {bannerText ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{bannerText}</p> : null}
          {cancelled ? <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">{t("lectures.upload.cancelled")}</p> : null}

          <fieldset className="space-y-2" disabled={pending}>
            <legend className="mb-2 text-sm font-medium">{t("lectures.kind.label")}</legend>
            <div role="radiogroup" aria-label={t("lectures.kind.label")} className="grid gap-3 sm:grid-cols-2">
              {(["subject", "general"] as const).map((value) => (
                <label key={value} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-start transition", kind === value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/40", pending && "cursor-not-allowed opacity-60")}>
                  <input type="radio" name="lecture-kind" value={value} checked={kind === value} onChange={() => { setKind(value); setErrors((current) => ({ ...current, subject: undefined })); setCancelled(false); }} className="mt-1 size-4 accent-[hsl(var(--primary))]" />
                  <span>
                    <span className="block text-sm font-bold">{t(value === "subject" ? "lectures.kind.subject" : "lectures.kind.general")}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{t(value === "subject" ? "lectures.kind.subjectHint" : "lectures.kind.generalHint")}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {kind === "subject" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="lecture-faculty-filter">{t("lectures.faculty.label")}</Label>
                <FacultySelect id="lecture-faculty-filter" value={facultyFilter} allowAll faculties={faculties} disabled={pending} onChange={(next) => { setFacultyFilter(next); if (subject && next && !(subjects.data ?? []).some((item) => String(item.id) === subject && String(item.faculty) === next)) setSubject(""); }} />
                {facultyFilter ? <p className="text-xs text-muted-foreground">{t("lectures.faculty.subjectsOf")}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lecture-subject">{t("lectures.upload.subject")}<span className="ms-1 text-destructive" aria-hidden="true">*</span></Label>
                <Select value={subject} onValueChange={(next) => { setSubject(next); clearError("subject"); }} disabled={pending}>
                  <SelectTrigger id="lecture-subject" aria-required aria-invalid={fieldError.subject ? true : undefined} aria-describedby={describedBy("subject")} aria-busy={subjects.isPending}>
                    <SelectValue placeholder={subjects.isPending ? t("common.loading") : t("lectures.upload.subjectPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleSubjects.map((item) => <SelectItem key={String(item.id)} value={String(item.id)}>{relationLabel(item)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {subjects.isError ? <p role="alert" className="text-xs font-medium text-destructive">{t("lectures.filter.subjectsFailed")}</p> : null}
                {errorLine("subject")}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="lecture-general-faculty">{t("lectures.faculty.optionalLabel")}</Label>
              <FacultySelect id="lecture-general-faculty" value={generalFaculty} allowAll faculties={faculties} disabled={pending} invalid={Boolean(fieldError.faculty)} describedBy={describedBy("faculty")} onChange={(next) => { setGeneralFaculty(next); setCancelled(false); }} />
              <p className="text-xs text-muted-foreground">{t("lectures.kind.generalHint")}</p>
              {errorLine("faculty")}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="lecture-title">{t("lectures.upload.titleField")}<span className="ms-1 text-destructive" aria-hidden="true">*</span></Label>
            <Input id="lecture-title" value={title} maxLength={LECTURE_TITLE_MAX} disabled={pending} aria-required aria-invalid={fieldError.title ? true : undefined} aria-describedby={describedBy("title")} onChange={(event) => { setTitle(event.target.value); clearError("title"); }} />
            {errorLine("title")}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lecture-description">{t("lectures.upload.descriptionField")}</Label>
            <Textarea id="lecture-description" value={description} disabled={pending} rows={3} aria-invalid={fieldError.description ? true : undefined} aria-describedby={describedBy("description")} onChange={(event) => setDescription(event.target.value)} />
            {errorLine("description")}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lecture-file">{t("lectures.upload.file")}<span className="ms-1 text-destructive" aria-hidden="true">*</span></Label>
            <Input
              id="lecture-file"
              ref={fileInput}
              type="file"
              accept={acceptAttribute(LECTURE_POLICY)}
              disabled={pending}
              aria-required
              aria-invalid={fieldError.file ? true : undefined}
              aria-describedby={describedBy("file", true)}
              onChange={(event) => {
                const chosen = event.target.files?.[0] ?? null;
                const rejected = chosen ? lectureFileMessage(chosen) : null;
                setCancelled(false);
                if (rejected) {
                  // A rejected file is never kept: clear the input so the same name can be picked again after fixing it.
                  event.target.value = "";
                  setFile(null);
                  setErrors((current) => ({ ...current, file: rejected }));
                  return;
                }
                setFile(chosen);
                clearError("file");
              }}
            />
            <p id="lecture-file-hint" className="text-xs text-muted-foreground">
              {t("lectures.upload.fileHint", { types: LECTURE_POLICY.extensions.map((extension) => extension.toUpperCase()).join(", "), max: Math.floor(effectiveMaxBytes(LECTURE_POLICY) / (1024 * 1024)) })}
            </p>
            {errorLine("file")}
          </div>

          {pending ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>{sentAll ? t("lectures.upload.finishing") : t("lectures.upload.progress", { percent })}</span>
              </div>
              <div role="progressbar" aria-label={t("lectures.upload.progressLabel")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
              </div>
            </div>
          ) : null}
          <div role="status" aria-live="polite" className="sr-only" data-testid="lecture-upload-live">{sentAll ? t("lectures.upload.finishing") : announced}</div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {pending ? (
              <Button type="button" variant="outline" onClick={() => abortRef.current?.abort()}>{t("lectures.upload.cancelUpload")}</Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            )}
            <Button type="submit" isLoading={pending} disabled={pending}>{t("lectures.upload.submit")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
