/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LectureUploadDialog } from "@/features/lectures/lecture-upload-dialog";
import { I18nProvider } from "@/i18n/provider";
import { AppApiError } from "@/lib/api/errors";

const uploadMock = vi.fn();
vi.mock("@/lib/api/browser-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser-client")>()),
  apiFetch: vi.fn(async () => ({ data: { count: 2, results: [{ id: 7, name: "Algorithms", code: "CS201" }, { id: 8, name: "Databases", code: "CS301" }] } })),
  apiUpload: (...args: unknown[]) => uploadMock(...args),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
beforeEach(() => {
  // Radix Select relies on pointer-capture and scrollIntoView, which jsdom lacks.
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
  uploadMock.mockReset();
});
afterEach(cleanup);

function renderDialog(locale: "en" | "ar" = "en") {
  const onOpenChange = vi.fn();
  const onUploaded = vi.fn();
  render(
    <I18nProvider locale={locale}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <LectureUploadDialog onOpenChange={onOpenChange} onUploaded={onUploaded} />
      </QueryClientProvider>
    </I18nProvider>,
  );
  return { onOpenChange, onUploaded };
}

const pick = (input: HTMLElement, file: File) => userEvent.upload(input, file, { applyAccept: false });
const pdf = (name = "lecture.pdf") => new File(["%PDF-1.4"], name, { type: "application/pdf" });

async function chooseSubject(name: RegExp) {
  await userEvent.click(screen.getByRole("combobox", { name: /Subject/u }));
  await userEvent.click(await screen.findByRole("option", { name }));
}

async function fillValid() {
  await chooseSubject(/Algorithms/u);
  await userEvent.type(screen.getByLabelText(/Lecture title/u), "Sorting");
  await pick(screen.getByLabelText(/Lecture file/u, { selector: "input" }), pdf());
}

describe("lecture upload dialog", () => {
  it("blocks a rejected file type and an oversized file before anything is sent, with aria-invalid and a described error", async () => {
    renderDialog();
    const input = screen.getByLabelText(/Lecture file/u, { selector: "input" });
    await pick(input, new File(["MZ"], "setup.exe", { type: "application/x-msdownload" }));
    expect(screen.getByText(/This file type is not supported. Allowed types: PDF, DOC, DOCX, PPT, PPTX/u)).toBeTruthy();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain("lecture-file-error");

    const huge = pdf("huge.pdf");
    Object.defineProperty(huge, "size", { value: 50 * 1024 * 1024 + 1 });
    await pick(input, huge);
    expect(screen.getByText(/larger than the allowed limit \(50 MB\)/u)).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Upload lecture" }));
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("requires subject, title and file and marks each invalid field", async () => {
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Upload lecture" }));
    expect(uploadMock).not.toHaveBeenCalled();
    expect(screen.getByText("Select the subject.")).toBeTruthy();
    expect(screen.getByText("Choose the lecture file.")).toBeTruthy();
    expect(screen.getByLabelText(/Lecture title/u).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("combobox", { name: /Subject/u }).getAttribute("aria-invalid")).toBe("true");
  });

  it("uploads multipart data, shows real progress while pending, disables the form and closes on success", async () => {
    let finish: (value: unknown) => void = () => undefined;
    let report: (loaded: number, total: number) => void = () => undefined;
    uploadMock.mockImplementation((_path: string, _body: FormData, options: { onProgress: typeof report }) => new Promise((resolve) => { finish = resolve; report = options.onProgress; }));
    const { onOpenChange, onUploaded } = renderDialog();
    await fillValid();
    await userEvent.click(screen.getByRole("button", { name: "Upload lecture" }));

    expect(uploadMock).toHaveBeenCalledTimes(1);
    const [path, body, options] = uploadMock.mock.calls[0] as [string, FormData, { idempotencyKey: string }];
    expect(path).toBe("/api/v1/dashboard/lectures/");
    expect(body.get("subject")).toBe("7");
    expect(body.get("title")).toBe("Sorting");
    expect((body.get("original_file") as File).name).toBe("lecture.pdf");
    expect(options.idempotencyKey).toBeTruthy();

    report(30, 100);
    const bar = await screen.findByRole("progressbar", { name: "File upload progress" });
    await waitFor(() => expect(bar.getAttribute("aria-valuenow")).toBe("30"));
    expect(screen.getByText("Uploading 30%")).toBeTruthy();
    expect((screen.getByLabelText(/Lecture title/u) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Cancel upload" })).toBeTruthy();
    expect((screen.getByRole("button", { name: /Upload lecture/u }) as HTMLButtonElement).disabled).toBe(true);

    report(100, 100);
    await waitFor(() => expect(screen.getAllByText(/waiting for the server/u).length).toBeGreaterThan(0));
    finish({ data: { id: 1 } });
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cancelling aborts the request and keeps the dialog open with a cancelled notice", async () => {
    uploadMock.mockImplementation((_path: string, _body: FormData, options: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")));
    }));
    const { onOpenChange } = renderDialog();
    await fillValid();
    await userEvent.click(screen.getByRole("button", { name: "Upload lecture" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancel upload" }));
    await waitFor(() => expect(screen.getAllByText("The upload was cancelled.").length).toBeGreaterThan(0));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/Lecture title/u) as HTMLInputElement).disabled).toBe(false);
  });

  it("shows a duplicate file (400 on original_file, or 409) as the clear message on the file field", async () => {
    uploadMock.mockRejectedValueOnce(new AppApiError({ status: 400, message: "Validation error", errors: { original_file: ["This source document is already registered for the subject."] } }));
    renderDialog();
    await fillValid();
    await userEvent.click(screen.getByRole("button", { name: "Upload lecture" }));
    const message = await screen.findByText("This file already exists for this subject.");
    expect(message.getAttribute("role")).toBe("alert");
    const input = screen.getByLabelText(/Lecture file/u, { selector: "input" });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain(message.id);

    uploadMock.mockRejectedValueOnce(new AppApiError({ status: 409, message: "Conflict", code: "CONFLICT" }));
    await userEvent.click(screen.getByRole("button", { name: "Upload lecture" }));
    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("This file already exists for this subject.")).toBeTruthy();
  });

  it("maps 400 field errors inline and 413 / 429 / 503 to localized banners", async () => {
    renderDialog();
    await fillValid();
    uploadMock.mockRejectedValueOnce(new AppApiError({ status: 400, message: "Validation error", errors: { title: ["Title is too similar."] } }));
    await userEvent.click(screen.getByRole("button", { name: "Upload lecture" }));
    expect(await screen.findByText("Title is too similar.")).toBeTruthy();
    expect(screen.getByLabelText(/Lecture title/u).getAttribute("aria-invalid")).toBe("true");

    uploadMock.mockRejectedValueOnce(new AppApiError({ status: 413, message: "too large", code: "REQUEST_TOO_LARGE" }));
    await userEvent.click(screen.getByRole("button", { name: "Upload lecture" }));
    expect(await screen.findByText("The file or the request is larger than the allowed limit.")).toBeTruthy();

    uploadMock.mockRejectedValueOnce(new AppApiError({ status: 429, message: "slow", retryAfter: 9 }));
    await userEvent.click(screen.getByRole("button", { name: "Upload lecture" }));
    expect(await screen.findByText(/Too many attempts. Wait 9 seconds/u)).toBeTruthy();

    uploadMock.mockRejectedValueOnce(new AppApiError({ status: 503, code: "MAINTENANCE_MODE", message: "down" }));
    await userEvent.click(screen.getByRole("button", { name: "Upload lecture" }));
    expect(await screen.findByText("The service is in maintenance mode right now. Try again later.")).toBeTruthy();
  });

  it("is available in Arabic", () => {
    renderDialog("ar");
    expect(screen.getByRole("heading", { name: "رفع محاضرة جديدة" })).toBeTruthy();
    expect(screen.getByText(/الأنواع المسموحة: PDF, DOC, DOCX, PPT, PPTX. الحد الأقصى 50 ميغابايت/u)).toBeTruthy();
  });
});
