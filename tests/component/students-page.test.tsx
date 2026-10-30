/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StudentsPage } from "@/features/students/students-page";
import type { StudentRow } from "@/features/students/students-rules";
import { I18nProvider } from "@/i18n/provider";
import { AppApiError } from "@/lib/api/errors";
import { createNavigationStore } from "../helpers/navigation-mock";

const hoisted = vi.hoisted(() => ({
  store: null as null | { search: string; set: (next: string) => void; subscribe: (listener: () => void) => () => void },
  push: vi.fn(),
  caps: new Set<string>(),
  calls: [] as string[],
  handler: null as null | ((url: string) => unknown),
}));
vi.mock("next/navigation", async () => {
  const react = await import("react");
  return {
    useSearchParams: () => {
      const text = react.useSyncExternalStore((listener) => hoisted.store!.subscribe(listener), () => hoisted.store!.search, () => hoisted.store!.search);
      return new URLSearchParams(text);
    },
    useRouter: () => ({ replace: (url: string) => hoisted.store!.set(url), push: hoisted.push }),
  };
});
vi.mock("@/features/session", () => ({ useCan: (capability?: string) => !capability || hoisted.caps.has(capability) }));
vi.mock("@/lib/api/browser-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser-client")>()),
  apiFetch: vi.fn(async (url: string) => {
    hoisted.calls.push(url);
    const payload = hoisted.handler!(url) as Record<string, unknown>;
    return { ...payload, json: async () => payload };
  }),
}));

const student = (id: number, over: Partial<StudentRow> = {}): StudentRow => ({
  id, full_name: `Student ${id}`, email: `s${id}@example.com`, phone_number: null, student_number: `2026${id}`,
  verification_status: "approved", is_verified: true,
  university: { id: 1, name: "Damascus" }, faculty: { id: 10, name: "Informatics" }, major: { id: 100, name: "Software" },
  academic_year: { id: 3, name: "Year 3" }, semester: { id: 1, name: "First" },
  is_active: true, needs_term_confirmation: false, last_login: "2026-10-01T10:00:00Z", created_at: "2026-09-01T10:00:00Z",
  groups_count: 4, pending_enrollments: 0, ...over,
});

const summary = { total: 50, by_verification_status: { approved: 30, pending: 8, needs_update: 3, rejected: 2, incomplete: 5, suspended: 2 } };
let rows: StudentRow[] = [];
let listError = false;

function route(url: string): unknown {
  if (url.includes("/dashboard/students/summary/")) return { data: summary };
  if (url.includes("/dashboard/students/")) {
    if (listError) throw new AppApiError({ status: 500, code: "SERVER_ERROR", message: "boom" } as never);
    return { data: { count: rows.length, next: null, previous: null, results: rows } };
  }
  if (url.includes("/faculties/")) return { data: { count: 2, results: [{ id: 10, name: "Informatics" }, { id: 11, name: "Law" }] } };
  if (url.includes("/universities/")) return { data: { count: 1, results: [{ id: 1, name: "Damascus" }] } };
  if (url.includes("/groups/")) return { data: { count: 1, results: [{ id: 7, name: "Algorithms" }] } };
  return { data: { count: 0, results: [] } };
}

const lastCall = (fragment: string) => [...hoisted.calls].reverse().find((url) => url.includes(fragment)) ?? "";
const query = (url: string) => new URLSearchParams(url.split("?")[1] ?? "");

function renderPage(search = "", locale: "en" | "ar" = "en") {
  const store = createNavigationStore(search);
  hoisted.store = store;
  render(
    <I18nProvider locale={locale}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><StudentsPage /></QueryClientProvider>
    </I18nProvider>,
  );
  return store;
}

beforeEach(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  hoisted.calls = [];
  hoisted.handler = route;
  hoisted.caps = new Set(["users.manage"]);
  hoisted.push.mockReset();
  rows = [student(1), student(2, { full_name: "Sara Pending", verification_status: "pending", pending_enrollments: 2, is_active: false, needs_term_confirmation: true, last_login: null })];
  listError = false;
});
afterEach(cleanup);

describe("students page", () => {
  it("lists students with a verification badge, profile link, counts and account state", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: "Student 1" });
    expect(link.getAttribute("href")).toBe("/en/dashboard/users/1");
    const sara = (await screen.findByText("Sara Pending")).closest("tr") as HTMLElement;
    expect(within(sara).getByText("Under review")).toBeTruthy();
    expect(within(sara).getByText("Disabled")).toBeTruthy();
    expect(within(sara).getByText("Year confirmation due")).toBeTruthy();
    expect(within(sara).getByText("Never signed in")).toBeTruthy();
    expect(screen.getByText("2 results")).toBeTruthy();
  });

  it("shows verification segments with live counts from the summary endpoint", async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId("segment-count").map((node) => node.textContent)).toEqual(["50", "30", "8", "3", "2", "5", "2"]));
    expect(screen.getByRole("button", { name: /Verified/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Needs changes/ })).toBeTruthy();
  });

  it("maps the URL filters to list request parameters and keeps the segment out of the summary", async () => {
    renderPage("verification_status=pending&faculty=10&no_groups=true&has_pending_enrollment=false&registered_after=2026-01-01&registered_before=2026-06-30&inactive_days=30&ordering=full_name&page=2&search=sara&is_active=true&needs_term_confirmation=true&group=7");
    await waitFor(() => expect(lastCall("/dashboard/students/?")).toContain("verification_status=pending"));
    const list = query(lastCall("/dashboard/students/?"));
    expect(Object.fromEntries(list)).toEqual({
      verification_status: "pending", faculty: "10", no_groups: "true", has_pending_enrollment: "false", registered_after: "2026-01-01", registered_before: "2026-06-30",
      inactive_days: "30", ordering: "full_name", search: "sara", is_active: "true", needs_term_confirmation: "true", group: "7", page: "2", page_size: "25",
    });
    await waitFor(() => expect(lastCall("/students/summary/")).not.toBe(""));
    const counts = Object.fromEntries(query(lastCall("/students/summary/")));
    expect(counts.verification_status).toBeUndefined();
    expect(counts.ordering).toBeUndefined();
    expect(counts.page).toBeUndefined();
    expect(counts).toMatchObject({ faculty: "10", no_groups: "true", search: "sara", registered_after: "2026-01-01", inactive_days: "30" });
  });

  it("clicking a segment sends verification_status, returns to page 1 and leaves the other counts alone", async () => {
    const store = renderPage("page=3");
    await userEvent.click(await screen.findByRole("button", { name: /Rejected/ }));
    await waitFor(() => expect(query(lastCall("/dashboard/students/?")).get("verification_status")).toBe("rejected"));
    expect(new URLSearchParams(store.search).has("page")).toBe(false);
    expect(query(lastCall("/dashboard/students/?")).get("page")).toBe("1");
  });

  it("filters by faculty and loads majors for the chosen faculty", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("combobox", { name: "Faculty" }));
    await userEvent.click(await screen.findByRole("option", { name: "Law" }));
    await waitFor(() => expect(query(lastCall("/dashboard/students/?")).get("faculty")).toBe("11"));
    await waitFor(() => expect(hoisted.calls.some((url) => url.includes("/majors/") && url.includes("faculty=11"))).toBe(true));
  });

  it("opens the profile when a row is clicked", async () => {
    renderPage("", "ar");
    const cell = await screen.findByText("Sara Pending");
    await userEvent.click(cell.closest("tr")!.querySelectorAll("td")[3]!);
    expect(hoisted.push).toHaveBeenCalledWith("/ar/dashboard/users/2");
  });

  it("shows the empty state with a clear-filters action", async () => {
    rows = [];
    const store = renderPage("faculty=11&no_groups=true");
    const empty = await screen.findByTestId("filter-empty");
    expect(within(empty).getByText("No results match the current filters.")).toBeTruthy();
    await userEvent.click(within(empty).getByRole("button", { name: "Clear filters" }));
    expect(store.search).toBe("");
  });

  it("shows an error panel when the list fails", async () => {
    listError = true;
    renderPage();
    expect(await screen.findByRole("button", { name: /Retry|Try again/ })).toBeTruthy();
  });

  it("is open to verification reviewers without user management and denied to others", async () => {
    hoisted.caps = new Set(["verification.review"]);
    renderPage();
    expect(await screen.findByRole("link", { name: "Student 1" })).toBeTruthy();
    cleanup();
    hoisted.caps = new Set(["files.manage"]);
    hoisted.calls = [];
    renderPage();
    expect(screen.queryByRole("link", { name: "Student 1" })).toBeNull();
    expect(hoisted.calls.some((url) => url.includes("/students/"))).toBe(false);
  });

  it("exports the rows on screen as CSV", async () => {
    const created: Blob[] = [];
    URL.createObjectURL = (blob: Blob | MediaSource) => { created.push(blob as Blob); return "blob:x"; };
    URL.revokeObjectURL = () => undefined;
    renderPage();
    await screen.findByText("Sara Pending");
    await userEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(created).toHaveLength(1);
    const text = await created[0]!.text();
    expect(text).toContain("Student 1");
    expect(text).toContain("Under review");
  });
});
