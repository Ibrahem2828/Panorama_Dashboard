/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LecturesPage } from "@/features/lectures/lectures-page";
import { I18nProvider } from "@/i18n/provider";
import { AppApiError } from "@/lib/api/errors";

const listMock = vi.fn();
let allowed = true;
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/session", () => ({ useCan: () => allowed }));
vi.mock("@/features/resources/resource-api", () => ({ listResource: (...args: unknown[]) => listMock(...args) }));
vi.mock("@/lib/api/browser-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser-client")>()),
  apiFetch: vi.fn(async () => ({ data: { count: 0, results: [] } })),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const old = new Date(Date.now() - 3 * 3600_000).toISOString();
const base = { subject: 1, subject_name: "Algorithms", is_published: false, page_count: 0, created_at: old, updated_at: old };
const rows = [
  { ...base, id: 1, title: "Ready one", status: "ready", page_count: 12 },
  { ...base, id: 2, title: "Failed one", status: "failed", failure_message: "Conversion failed." },
  { ...base, id: 3, title: "Queued fresh", status: "queued", updated_at: new Date().toISOString() },
  { ...base, id: 4, title: "Quarantined one", status: "quarantined" },
];

beforeEach(() => {
  allowed = true;
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  listMock.mockReset();
});
afterEach(cleanup);

const renderPage = (locale: "en" | "ar" = "en") => render(
  <I18nProvider locale={locale}>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LecturesPage /></QueryClientProvider>
  </I18nProvider>,
);

async function openMenu(title: string) {
  const row = (await screen.findByText(title)).closest("tr") as HTMLElement;
  await userEvent.click(row.querySelector("button[aria-label='Actions']") as HTMLElement);
}

describe("lectures page", () => {
  it("lists lectures with a text status badge, subject, pages and publication state", async () => {
    listMock.mockResolvedValue({ results: rows, count: 4, next: null, previous: null });
    renderPage();
    expect(await screen.findByText("Ready one")).toBeTruthy();
    expect(screen.getByText("Ready", { selector: "span[data-status]" })).toBeTruthy();
    expect(screen.getByText("Processing failed")).toBeTruthy();
    expect(screen.getByText("Queued")).toBeTruthy();
    expect(screen.getByText("Quarantined")).toBeTruthy();
    expect(screen.getAllByText("Algorithms").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not published").length).toBe(4);
    // A lecture is in flight, so the auto-refresh note is shown.
    expect(screen.getByTestId("lectures-auto-refresh")).toBeTruthy();
  });

  it("shows no auto-refresh note when every lecture is final", async () => {
    listMock.mockResolvedValue({ results: [rows[0], rows[1]], count: 2, next: null, previous: null });
    renderPage();
    await screen.findByText("Ready one");
    expect(screen.queryByTestId("lectures-auto-refresh")).toBeNull();
  });

  it("offers publish on a ready lecture only, retry on a failed one only, and neither on quarantined", async () => {
    listMock.mockResolvedValue({ results: rows, count: 4, next: null, previous: null });
    renderPage();
    await openMenu("Ready one");
    expect(screen.getByRole("menuitem", { name: "Publish" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Retry processing" })).toBeNull();
    await userEvent.keyboard("{Escape}");
    await openMenu("Failed one");
    expect(screen.getByRole("menuitem", { name: "Retry processing" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Publish" })).toBeNull();
    await userEvent.keyboard("{Escape}");
    await openMenu("Quarantined one");
    expect(screen.queryByRole("menuitem", { name: "Retry processing" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Publish" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
  });

  it("explains that students will see the lecture before publishing", async () => {
    listMock.mockResolvedValue({ results: [rows[0]], count: 1, next: null, previous: null });
    renderPage();
    await openMenu("Ready one");
    await userEvent.click(screen.getByRole("menuitem", { name: "Publish" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toMatch(/visible to every verified student/u);
  });

  it("denies access without lectures.manage and never loads the list", async () => {
    allowed = false;
    renderPage();
    await waitFor(() => expect(screen.queryByText("Lecture management")).toBeNull());
    expect(listMock).not.toHaveBeenCalled();
  });

  it("shows the empty state and the error state with a retry button", async () => {
    listMock.mockResolvedValueOnce({ results: [], count: 0, next: null, previous: null });
    const first = renderPage();
    expect(await screen.findByText("There are no lectures yet. Upload the first one to get started.")).toBeTruthy();
    first.unmount();
    listMock.mockRejectedValue(new AppApiError({ status: 500, message: "boom" }));
    renderPage();
    expect(await screen.findByRole("button", { name: "Retry" })).toBeTruthy();
  });
});
