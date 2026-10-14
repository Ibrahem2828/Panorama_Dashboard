/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResourceForm } from "@/components/forms/resource-form-dialog";
import { formSpecsFor, RESOURCE_FORM_POLICIES } from "@/features/resources/resource-form-policy";
import { I18nProvider } from "@/i18n/provider";

// The relation pickers (university, group, ...) read the reference lists; an empty list is enough here.
vi.mock("@/lib/api/browser-client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api/browser-client")>()), apiFetch: vi.fn(async () => ({ data: { count: 0, results: [] } })) }));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
afterEach(cleanup);

const renderLibraryForm = (props: Partial<React.ComponentProps<typeof ResourceForm>> = {}) => {
  const onSubmit = vi.fn();
  render(
    <I18nProvider locale="en">
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ResourceForm specs={formSpecsFor("files", "create")} mode="create" crossRules={RESOURCE_FORM_POLICIES.files!.crossRules} onSubmit={onSubmit} {...props} />
      </QueryClientProvider>
    </I18nProvider>,
  );
  return { onSubmit };
};

const upload = (input: HTMLElement, file: File) => userEvent.upload(input, file, { applyAccept: false });

describe("library upload form", () => {
  it("rejects an unsupported type and an oversized file before anything is sent, and marks the field invalid", async () => {
    const { onSubmit } = renderLibraryForm();
    const input = screen.getByLabelText(/File/u, { selector: "input" });
    await upload(input, new File(["MZ"], "setup.exe", { type: "application/x-msdownload" }));
    expect(screen.getByText(/This file type is not supported/u)).toBeTruthy();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const huge = new File(["x"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(huge, "size", { value: 26 * 1024 * 1024 });
    await upload(input, huge);
    expect(screen.getByText(/larger than the allowed limit \(25 MB\)/u)).toBeTruthy();
    await userEvent.type(screen.getByLabelText(/Title/u), "Lecture");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("submits multipart form data (title, visibility and the PDF) for a valid upload and is disabled while pending", async () => {
    const { onSubmit } = renderLibraryForm();
    await userEvent.type(screen.getByLabelText(/Title/u), "Lecture 1");
    await upload(screen.getByLabelText(/File/u, { selector: "input" }), new File(["%PDF-1.4"], "lecture.pdf", { type: "application/pdf" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const body = onSubmit.mock.calls[0]![0] as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("title")).toBe("Lecture 1");
    expect(body.get("visibility")).toBe("public");
    expect((body.get("file") as File).name).toBe("lecture.pdf");
    expect(body.get("is_printable")).toBe("false");
  });

  it("disables the form while a request is pending", () => {
    renderLibraryForm({ pending: true });
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText(/Title/u) as HTMLInputElement).disabled).toBe(true);
  });

  it("keeps the stored file on edit: no file is required and nothing is sent when nothing changed", async () => {
    const { onSubmit } = renderLibraryForm({ specs: formSpecsFor("files", "edit"), mode: "edit", entity: { title: "Old", visibility: "public", is_printable: false, is_active: true, description: "" } });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Nothing has changed, so there is nothing to save.")).toBeTruthy();
  });
});
