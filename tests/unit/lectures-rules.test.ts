import { describe, expect, it } from "vitest";

import {
  classifyLectureError, IN_FLIGHT_STATUSES, isInFlight, isRetryable, LECTURE_STATUSES, lectureActions, lectureQueryFilters,
  parseLectureParams, pollInterval, POLL_BASE_MS, POLL_MAX_MS, statusTone, STALLED_AFTER_MS, type LectureRow,
} from "@/features/lectures/lecture-rules";
import { buildLectureFormData, lectureFileMessage, progressPercent, validateLectureForm } from "@/features/lectures/lecture-upload";
import { shaPrefix } from "@/features/lectures/lecture-details-dialog";
import { messages } from "@/i18n/messages";
import { AppApiError } from "@/lib/api/errors";
import { LECTURE_POLICY } from "@/lib/uploads";

const MB = 1024 * 1024;
const NOW = Date.parse("2026-10-14T12:00:00Z");
const row = (patch: Partial<LectureRow> = {}): LectureRow => ({
  id: 1, subject: 3, title: "Lecture", status: "ready", is_published: false, updated_at: new Date(NOW - 60_000).toISOString(), ...patch,
});
const file = (name: string, size = 1024, type = "") => {
  const made = new File(["x"], name, { type });
  Object.defineProperty(made, "size", { value: size });
  return made;
};
const api = (status: number, extra: Partial<ConstructorParameters<typeof AppApiError>[0] & object> = {}) => new AppApiError({ status, message: "x", ...extra });

describe("processing statuses", () => {
  it("covers the nine backend statuses, each with Arabic and English labels", () => {
    expect([...LECTURE_STATUSES]).toEqual(["uploaded", "queued", "scanning", "converting", "extracting", "rendering", "ready", "failed", "quarantined"]);
    for (const status of LECTURE_STATUSES) {
      const key = `lectures.status.${status}` as keyof typeof messages.ar;
      expect(messages.ar[key], key).toBeTruthy();
      expect(messages.en[key], key).toBeTruthy();
    }
  });

  it("treats uploaded, queued and the four worker steps as in flight and ready, failed and quarantined as final", () => {
    expect([...IN_FLIGHT_STATUSES]).toEqual(["uploaded", "queued", "scanning", "converting", "extracting", "rendering"]);
    for (const status of ["ready", "failed", "quarantined"]) expect(isInFlight(status)).toBe(false);
    expect(isInFlight("nonsense")).toBe(false);
  });

  it("maps tones: success, danger (failed and quarantined), progress (in flight)", () => {
    expect(statusTone("ready")).toBe("success");
    expect(statusTone("failed")).toBe("danger");
    expect(statusTone("quarantined")).toBe("danger");
    expect(statusTone("processing")).toBe("neutral");
    for (const status of IN_FLIGHT_STATUSES) expect(statusTone(status)).toBe("progress");
  });
});

describe("auto-refresh rule", () => {
  it("polls every 10 s only while a visible lecture is in flight", () => {
    expect(pollInterval({ rows: [row({ status: "queued" })], hidden: false })).toBe(POLL_BASE_MS);
    expect(pollInterval({ rows: [row(), row({ status: "converting" })], hidden: false })).toBe(POLL_BASE_MS);
    expect(pollInterval({ rows: [row(), row({ status: "failed" }), row({ status: "quarantined" })], hidden: false })).toBe(false);
    expect(pollInterval({ rows: [], hidden: false })).toBe(false);
    expect(pollInterval({ rows: undefined, hidden: false })).toBe(false);
  });

  it("pauses while the tab is hidden", () => {
    expect(pollInterval({ rows: [row({ status: "processing" }), row({ status: "queued" })], hidden: true })).toBe(false);
  });

  it("backs off after failed refreshes and caps the delay", () => {
    const rows = [row({ status: "queued" })];
    expect(pollInterval({ rows, hidden: false, failures: 1 })).toBe(20_000);
    expect(pollInterval({ rows, hidden: false, failures: 2 })).toBe(40_000);
    expect(pollInterval({ rows, hidden: false, failures: 3 })).toBe(POLL_MAX_MS);
    expect(pollInterval({ rows, hidden: false, failures: 50 })).toBe(POLL_MAX_MS);
  });
});

describe("row action visibility", () => {
  const stale = (status: string) => row({ status, updated_at: new Date(NOW - STALLED_AFTER_MS - 1000).toISOString() });

  it("offers retry for failed and for stuck in-flight lectures, never for ready, quarantined or recent in-flight ones", () => {
    expect(isRetryable(row({ status: "failed" }), NOW)).toBe(true);
    for (const status of IN_FLIGHT_STATUSES) {
      expect(isRetryable(stale(status), NOW), status).toBe(true);
      expect(isRetryable(row({ status }), NOW), status).toBe(false);
    }
    expect(isRetryable(stale("ready"), NOW)).toBe(false);
    expect(isRetryable(stale("quarantined"), NOW)).toBe(false);
  });

  it("allows publishing only a ready, unpublished lecture; unpublishing whenever it is published", () => {
    const ctx = { canManage: true, now: NOW };
    expect(lectureActions(row({ status: "ready" }), ctx).publish).toBe(true);
    expect(lectureActions(row({ status: "ready", is_published: true }), ctx)).toMatchObject({ publish: false, unpublish: true });
    for (const status of ["queued", "converting", "failed", "quarantined"]) expect(lectureActions(row({ status }), ctx).publish, status).toBe(false);
    expect(lectureActions(row({ status: "failed", is_published: true }), ctx).unpublish).toBe(true);
  });

  it("without lectures.manage nothing but viewing is offered", () => {
    const actions = lectureActions(row({ status: "failed", is_published: true }), { canManage: false, now: NOW });
    expect(actions).toEqual({ view: true, edit: false, delete: false, publish: false, unpublish: false, retry: false });
  });
});

describe("URL filters", () => {
  it("reads page, page size, subject, status and published, dropping invalid values", () => {
    const params = new URLSearchParams("page=3&page_size=50&subject=12&status=failed&is_published=true");
    expect(parseLectureParams(params)).toEqual({ page: 3, pageSize: 50, subject: "12", scope: "", status: "failed", isPublished: "true" });
    expect(parseLectureParams(new URLSearchParams("page=-1&page_size=7&subject=abc&scope=other&status=processing&is_published=maybe"))).toEqual({ page: 1, pageSize: 25, subject: "", scope: "", status: "", isPublished: "" });
    expect(parseLectureParams(new URLSearchParams())).toEqual({ page: 1, pageSize: 25, subject: "", scope: "", status: "", isPublished: "" });
    expect(parseLectureParams(new URLSearchParams("scope=general")).scope).toBe("general");
    expect(parseLectureParams(new URLSearchParams("scope=subject")).scope).toBe("subject");
  });

  it("sends only the active filters, with the backend's parameter names", () => {
    expect(lectureQueryFilters(parseLectureParams(new URLSearchParams("subject=4&status=ready&is_published=false")))).toEqual({ subject: "4", status: "ready", is_published: "false" });
    expect(lectureQueryFilters(parseLectureParams(new URLSearchParams("status=queued")))).toEqual({ status: "queued" });
    expect(lectureQueryFilters(parseLectureParams(new URLSearchParams()))).toEqual({});
    expect(lectureQueryFilters(parseLectureParams(new URLSearchParams("scope=general")))).toEqual({ scope: "general" });
  });
});

describe("upload validation (mirrors LECTURE_DOCUMENT_POLICY)", () => {
  it("allows exactly pdf, doc, docx, ppt and pptx up to 50 MB", () => {
    expect([...LECTURE_POLICY.extensions]).toEqual(["pdf", "doc", "docx", "ppt", "pptx"]);
    expect(LECTURE_POLICY.maxBytes).toBe(50 * MB);
    for (const name of ["a.pdf", "a.doc", "a.docx", "a.ppt", "A.PPTX"]) expect(lectureFileMessage({ name, size: 10, type: "" }), name).toBeNull();
    expect(lectureFileMessage({ name: "a.pdf", size: 50 * MB, type: "application/pdf" })).toBeNull();
  });

  it("rejects a wrong type, an oversized and an empty file with localized message keys", () => {
    expect(lectureFileMessage({ name: "setup.exe", size: 10, type: "application/x-msdownload" })).toEqual({ key: "upload.type", values: { types: "PDF, DOC, DOCX, PPT, PPTX" } });
    expect(lectureFileMessage({ name: "notes.xlsx", size: 10, type: "" })?.key).toBe("upload.type");
    expect(lectureFileMessage({ name: "a.pdf", size: 10, type: "image/png" })?.key).toBe("upload.type");
    expect(lectureFileMessage({ name: "big.pdf", size: 50 * MB + 1, type: "application/pdf" })).toEqual({ key: "upload.size", values: { max: 50 } });
    expect(lectureFileMessage({ name: "empty.pdf", size: 0, type: "application/pdf" })).toEqual({ key: "upload.empty" });
  });

  it("requires subject, title and file, and caps the title at 255", () => {
    const ok = file("a.pdf", 10);
    expect(validateLectureForm({ kind: "subject", subject: "", faculty: "", title: "  ", description: "", file: null })).toEqual({
      subject: { key: "lectures.validation.subject" }, title: { key: "validation.required" }, file: { key: "lectures.validation.file" },
    });
    expect(validateLectureForm({ kind: "subject", subject: "2", faculty: "", title: "x".repeat(256), description: "", file: ok }).title?.key).toBe("validation.maxLength");
    expect(validateLectureForm({ kind: "subject", subject: "2", faculty: "", title: "Intro", description: "", file: ok })).toEqual({});
    expect(validateLectureForm({ kind: "subject", subject: "2", faculty: "", title: "Intro", description: "", file: file("a.exe", 10) }).file?.key).toBe("upload.type");
  });

  it("does not require a subject for a general lecture (optional faculty)", () => {
    const ok = file("a.pdf", 10);
    expect(validateLectureForm({ kind: "general", subject: "", faculty: "", title: "Orientation", description: "", file: ok })).toEqual({});
    expect(validateLectureForm({ kind: "general", subject: "", faculty: "5", title: "Orientation", description: "", file: ok })).toEqual({});
  });

  it("builds the multipart body with the serializer's field names and omits an empty description", () => {
    const body = buildLectureFormData({ kind: "subject", subject: "2", faculty: "9", title: " Intro ", description: "  ", file: file("a.pdf", 10) });
    expect(body.get("subject")).toBe("2");
    expect(body.has("faculty")).toBe(false);
    expect(body.get("title")).toBe("Intro");
    expect(body.has("description")).toBe(false);
    expect((body.get("original_file") as File).name).toBe("a.pdf");
    expect(buildLectureFormData({ kind: "subject", subject: "2", faculty: "", title: "T", description: "About", file: null }).get("description")).toBe("About");
  });

  it("sends subject XOR faculty: a general lecture sends the faculty or nothing, never an empty subject", () => {
    const general = buildLectureFormData({ kind: "general", subject: "2", faculty: "5", title: "T", description: "", file: null });
    expect(general.get("faculty")).toBe("5");
    expect(general.has("subject")).toBe(false);
    const allFaculties = buildLectureFormData({ kind: "general", subject: "", faculty: "", title: "T", description: "", file: null });
    expect(allFaculties.has("subject")).toBe(false);
    expect(allFaculties.has("faculty")).toBe(false);
  });

  it("computes whole-percent progress", () => {
    expect(progressPercent(0, 0)).toBe(0);
    expect(progressPercent(1, 3)).toBe(33);
    expect(progressPercent(99, 100)).toBe(99);
    expect(progressPercent(100, 100)).toBe(100);
    expect(progressPercent(500, 100)).toBe(100);
  });
});

describe("error mapping", () => {
  it("a 400 on original_file saying it is already registered is a duplicate", () => {
    const error = api(400, { errors: { original_file: ["This source document is already registered for the subject."] } });
    expect(classifyLectureError(error, "upload").kind).toBe("duplicate");
  });

  it("other 400s keep the field messages for inline display", () => {
    const error = api(400, { errors: { title: ["This field may not be blank."], original_file: ["Unsupported file type."] } });
    expect(classifyLectureError(error, "upload")).toEqual({ kind: "fields", fields: { title: "This field may not be blank.", original_file: "Unsupported file type." } });
    expect(classifyLectureError(api(400)).kind).toBe("other");
  });

  it("409 means duplicate on upload, not retryable on retry, and idempotency conflicts stay generic", () => {
    expect(classifyLectureError(api(409), "upload").kind).toBe("duplicate");
    expect(classifyLectureError(api(409), "retry").kind).toBe("notRetryable");
    expect(classifyLectureError(api(409, { code: "lecture_not_retryable" }), "action").kind).toBe("notRetryable");
    expect(classifyLectureError(api(409, { code: "IDEMPOTENCY_KEY_REUSED" }), "upload").kind).toBe("other");
    expect(classifyLectureError(api(409), "action").kind).toBe("other");
  });

  it("maps 413, 429 (with Retry-After), 503 maintenance vs unavailable, 403 and 404", () => {
    expect(classifyLectureError(api(413)).kind).toBe("tooLarge");
    expect(classifyLectureError(api(429, { retryAfter: 12 }))).toMatchObject({ kind: "rateLimited", retryAfter: 12 });
    expect(classifyLectureError(api(503, { code: "MAINTENANCE_MODE" })).kind).toBe("maintenance");
    expect(classifyLectureError(api(503, { code: "BACKEND_NETWORK_UNAVAILABLE" })).kind).toBe("unavailable");
    expect(classifyLectureError(api(403)).kind).toBe("forbidden");
    expect(classifyLectureError(api(404)).kind).toBe("notFound");
    expect(classifyLectureError(new Error("boom")).kind).toBe("other");
  });

  it("every message the UI shows has Arabic and English text", () => {
    for (const key of ["duplicate", "notRetryable", "tooLarge", "maintenance", "unavailable", "forbidden", "notFound", "generic"]) {
      expect(messages.ar[`lectures.error.${key}` as keyof typeof messages.ar]).toBeTruthy();
      expect(messages.en[`lectures.error.${key}` as keyof typeof messages.en]).toBeTruthy();
    }
    expect(messages.en["lectures.error.duplicate"]).toBe("This file already exists in the same scope (subject or faculty).");
  });
});

describe("details", () => {
  it("shows only a prefix of the SHA-256", () => {
    expect(shaPrefix("a".repeat(64))).toBe("a".repeat(12));
    expect(shaPrefix(undefined)).toBe("—");
  });
});
