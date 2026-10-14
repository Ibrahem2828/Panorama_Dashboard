/**
 * Client-side upload limits for contract file fields.
 *
 * Mirrors the backend (`apps/common/file_validation.py`): DOCUMENT_POLICY pdf/png/jpg/jpeg/webp <= 25 MB
 * (`MAX_DOCUMENT_UPLOAD_SIZE`), IMAGE_POLICY png/jpg/jpeg/webp <= 8 MB (`MAX_IMAGE_UPLOAD_SIZE`) and
 * LECTURE_DOCUMENT_POLICY pdf/doc/docx/ppt/pptx <= 50 MB (`LECTURE_MAX_UPLOAD_SIZE`); empty files are rejected there too.
 * The server stays authoritative (it sniffs the real content); this only gives early, localized feedback.
 */

const MB = 1024 * 1024;

/** The BFF accepts request bodies up to 51 MiB (MAX_BODY_BYTES): the largest backend limit (50 MiB lectures) plus multipart framing. */
export const MAX_REQUEST_UPLOAD_BYTES = 50 * MB;

export interface UploadPolicy {
  extensions: readonly string[];
  mimeTypes: readonly string[];
  maxBytes: number;
}

export const DOCUMENT_POLICY: UploadPolicy = {
  extensions: ["pdf", "png", "jpg", "jpeg", "webp"],
  mimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
  maxBytes: 25 * MB,
};

export const IMAGE_POLICY: UploadPolicy = {
  extensions: ["png", "jpg", "jpeg", "webp"],
  mimeTypes: ["image/png", "image/jpeg", "image/webp"],
  maxBytes: 8 * MB,
};

export const LECTURE_POLICY: UploadPolicy = {
  extensions: ["pdf", "doc", "docx", "ppt", "pptx"],
  mimeTypes: [
    "application/pdf",
    "application/msword",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "application/x-ole-storage",
  ],
  maxBytes: 50 * MB,
};

/**
 * The file library (`/dashboard/files/`) validates with the backend DOCUMENT policy (`validate_document_upload`), so the
 * library accepts exactly the document types and size above; there is no wider "library" policy on the server.
 */
export const LIBRARY_POLICY: UploadPolicy = DOCUMENT_POLICY;

/** Which backend policy governs a contract file field. Unknown fields get the strictest document-or-image default. */
export function uploadPolicyForField(fieldName: string): UploadPolicy {
  if (fieldName === "original_file") return LECTURE_POLICY;
  if (fieldName === "image" || fieldName.endsWith("_image")) return IMAGE_POLICY;
  return DOCUMENT_POLICY;
}

/** The size a file may actually have: the backend limit, but never more than one BFF request can carry. */
export function effectiveMaxBytes(policy: UploadPolicy): number {
  return Math.min(policy.maxBytes, MAX_REQUEST_UPLOAD_BYTES);
}

/** Value for `<input accept>`. */
export function acceptAttribute(policy: UploadPolicy): string {
  return [...policy.extensions.map((extension) => `.${extension}`), ...policy.mimeTypes].join(",");
}

export type UploadProblem = "type" | "size" | "empty";

export function fileExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index + 1).toLowerCase();
}

/** Returns what is wrong with a candidate upload, or null when it satisfies the policy. */
export function validateUpload(file: Pick<File, "name" | "size" | "type">, policy: UploadPolicy): UploadProblem | null {
  if (!policy.extensions.includes(fileExtension(file.name))) return "type";
  const mime = (file.type.split(";")[0] ?? "").trim().toLowerCase();
  if (mime && mime !== "application/octet-stream" && !policy.mimeTypes.includes(mime)) return "type";
  if (file.size <= 0) return "empty";
  if (file.size > effectiveMaxBytes(policy)) return "size";
  return null;
}
