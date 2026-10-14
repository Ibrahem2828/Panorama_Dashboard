import type { MessageKey } from "@/i18n/messages";
import { effectiveMaxBytes, LECTURE_POLICY, validateUpload } from "@/lib/uploads";

export const LECTURE_TITLE_MAX = 255;

export interface LectureFormValues {
  subject: string;
  title: string;
  description: string;
  file: File | null;
}

export interface FormMessage { key: MessageKey; values?: Record<string, string | number> }
export type LectureFormErrors = Partial<Record<"subject" | "title" | "file", FormMessage>>;

/** The localized message for a rejected file (type, size or empty), mirroring the backend LECTURE_DOCUMENT_POLICY. */
export function lectureFileMessage(file: Pick<File, "name" | "size" | "type">): FormMessage | null {
  const problem = validateUpload(file, LECTURE_POLICY);
  if (problem === "type") return { key: "upload.type", values: { types: LECTURE_POLICY.extensions.map((extension) => extension.toUpperCase()).join(", ") } };
  if (problem === "size") return { key: "upload.size", values: { max: Math.floor(effectiveMaxBytes(LECTURE_POLICY) / (1024 * 1024)) } };
  if (problem === "empty") return { key: "upload.empty" };
  return null;
}

/** Client-side validation of the upload form (the server stays authoritative). Empty object means valid. */
export function validateLectureForm(values: LectureFormValues): LectureFormErrors {
  const errors: LectureFormErrors = {};
  if (!values.subject) errors.subject = { key: "lectures.validation.subject" };
  const title = values.title.trim();
  if (!title) errors.title = { key: "validation.required" };
  else if (title.length > LECTURE_TITLE_MAX) errors.title = { key: "validation.maxLength", values: { n: LECTURE_TITLE_MAX } };
  if (!values.file) errors.file = { key: "lectures.validation.file" };
  else {
    const problem = lectureFileMessage(values.file);
    if (problem) errors.file = problem;
  }
  return errors;
}

/** Multipart body of `POST /dashboard/lectures/` (field names are the serializer's). */
export function buildLectureFormData(values: LectureFormValues): FormData {
  const body = new FormData();
  body.set("subject", values.subject);
  body.set("title", values.title.trim());
  const description = values.description.trim();
  if (description) body.set("description", description);
  if (values.file) body.set("original_file", values.file);
  return body;
}

/** Whole-percent progress, never 100 until the browser reports the full body as sent. */
export function progressPercent(loaded: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.max(0, Math.min(100, Math.floor((loaded / total) * 100)));
}
