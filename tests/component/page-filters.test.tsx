/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatConsolePage } from "@/features/chat/chat-console-page";
import { EnrollmentReviewPage } from "@/features/enrollment/enrollment-review-page";
import { GroupsPage } from "@/features/groups/groups-page";
import { LecturesPage } from "@/features/lectures/lectures-page";
import { SubjectsPage } from "@/features/subjects/subjects-page";
import { VerificationPage } from "@/features/verifications/verification-page";
import { I18nProvider } from "@/i18n/provider";
import { createNavigationStore } from "../helpers/navigation-mock";

const hoisted = vi.hoisted(() => ({
  store: null as null | { search: string; set: (next: string) => void; subscribe: (listener: () => void) => () => void },
  calls: [] as string[],
  list: vi.fn(),
}));
vi.mock("next/navigation", async () => {
  const react = await import("react");
  return {
    useSearchParams: () => {
      const text = react.useSyncExternalStore((listener) => hoisted.store!.subscribe(listener), () => hoisted.store!.search, () => hoisted.store!.search);
      return new URLSearchParams(text);
    },
    useRouter: () => ({ replace: (url: string) => hoisted.store!.set(url), push: vi.fn() }),
  };
});
vi.mock("@/features/session", () => ({ useCan: () => true, useSession: () => ({ user: { id: 1, role: "admin" } }) }));
vi.mock("@/features/resources/resource-api", () => ({ listResource: (...args: unknown[]) => hoisted.list(...args) }));
vi.mock("@/lib/api/browser-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser-client")>()),
  apiFetch: vi.fn(async (url: string) => {
    hoisted.calls.push(url);
    const kind = new URL(`http://x${url}`).searchParams.get("kind");
    const counts: Record<string, number> = { "": 40, subject: 30, faculty: 6, general: 4 };
    if (url.includes("/dashboard/groups/?") && /page_size=1(&|$)/u.test(url)) return { data: { count: counts[kind ?? ""], results: [] } };
    return { data: { count: 0, results: [] } };
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const renderPage = (node: ReactNode, search = "") => {
  const store = createNavigationStore(search);
  hoisted.store = store;
  render(
    <I18nProvider locale="en">
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider>
    </I18nProvider>,
  );
  return store;
};
const listFilters = () => (hoisted.list.mock.calls.at(-1)?.[1] ?? {}) as { filters?: Record<string, string>; page?: number; pageSize?: number; ordering?: string; search?: string };
const lastCall = (fragment: string) => [...hoisted.calls].reverse().find((url) => url.includes(fragment)) ?? "";
const query = (url: string) => new URLSearchParams(url.split("?")[1] ?? "");

beforeEach(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  hoisted.calls = [];
  hoisted.list.mockReset();
  hoisted.list.mockResolvedValue({ results: [{ id: 1, name: "Algorithms", title: "T", is_active: true, groups_count: 3, lectures_count: 2, files_count: 5, created_at: "2026-01-01T00:00:00Z" }], count: 1, next: null, previous: null });
});
afterEach(cleanup);

describe("subjects page filters", () => {
  it("maps the URL to the list request and shows the count columns", async () => {
    renderPage(<SubjectsPage />, "faculty=3&major=9&academic_year=2&semester=1&is_active=true&has_groups=true&has_lectures=false&has_files=true&search=algo&ordering=name&page=2");
    await waitFor(() => expect(hoisted.list).toHaveBeenCalled());
    expect(listFilters()).toMatchObject({
      page: 2, pageSize: 25, search: "algo", ordering: "name",
      filters: { faculty: "3", major: "9", academic_year: "2", semester: "1", is_active: "true", has_groups: "true", has_lectures: "false", has_files: "true" },
    });
    expect(await screen.findByText("Algorithms")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Groups" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Lectures" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Files" })).toBeTruthy();
    expect(screen.getByText("1 results")).toBeTruthy();
  });

  it("defaults the sort to newest and clears dependants when the university changes", async () => {
    const store = renderPage(<SubjectsPage />, "university=1&faculty=3&major=9");
    await waitFor(() => expect(hoisted.list).toHaveBeenCalled());
    expect(listFilters().ordering).toBe("-created_at");
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(store.search).toBe("");
  });
});

describe("groups page filters", () => {
  it("shows kind segments with counts and sends the advanced filters", async () => {
    renderPage(<GroupsPage />, "kind=subject&faculty=2&requires_approval=true&has_whatsapp=false&has_pending_requests=true&members_min=5&members_max=40&created_after=2026-01-01&created_before=2026-06-30&send_messages_permission=admins_only&ordering=-members_count");
    await waitFor(() => expect(hoisted.list).toHaveBeenCalled());
    expect(listFilters().ordering).toBe("-members_count");
    expect(listFilters().filters).toEqual({
      kind: "subject", faculty: "2", requires_approval: "true", has_whatsapp: "false", has_pending_requests: "true", members_min: "5", members_max: "40",
      created_after: "2026-01-01", created_before: "2026-06-30", send_messages_permission: "admins_only",
    });
    await waitFor(() => expect(screen.getAllByTestId("segment-count").map((node) => node.textContent)).toEqual(["40", "30", "6", "4"]));
    expect(screen.getByRole("button", { name: /Subject groups/ }).getAttribute("aria-pressed")).toBe("true");
    // The per-kind counts honour the other filters but not the kind itself or the sort.
    const kindCount = [...hoisted.calls].reverse().find((url) => url.includes("kind=faculty") && url.includes("page_size=1")) ?? "";
    expect(Object.fromEntries(query(kindCount))).toMatchObject({ kind: "faculty", faculty: "2", requires_approval: "true", members_min: "5", page_size: "1" });
    expect(query(kindCount).get("ordering")).toBeNull();
    const allCount = [...hoisted.calls].reverse().find((url) => url.includes("page_size=1") && !url.includes("kind=")) ?? "";
    expect(query(allCount).get("kind")).toBeNull();
  });
});

describe("chat console list filters", () => {
  it("sends the new parameters, keeps the legacy reported flag for the quick toggle and offers clear filters", async () => {
    const store = renderPage(<ChatConsolePage />, "has_open_reports=true&kind=faculty&faculty=2&academic_year=3&semester=1&subject=8&has_messages=true&active_after=2026-09-01&ordering=-open_reports&search=maths");
    await waitFor(() => expect(lastCall("/dashboard/chat/groups/")).not.toBe(""));
    const params = query(lastCall("/dashboard/chat/groups/"));
    expect(Object.fromEntries(params)).toMatchObject({
      page_size: "100", has_open_reports: "true", reported: "1", kind: "faculty", faculty: "2", academic_year: "3", semester: "1", subject: "8",
      has_messages: "true", active_after: "2026-09-01", ordering: "-open_reports", search: "maths",
    });
    expect(await screen.findByText("No results match the current filters.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(store.search).toBe("ordering=-open_reports");
  });

  it("toggles reported-only through the segment and defaults the sort to the latest message", async () => {
    const store = renderPage(<ChatConsolePage />);
    await waitFor(() => expect(lastCall("/dashboard/chat/groups/")).not.toBe(""));
    expect(query(lastCall("/dashboard/chat/groups/")).get("ordering")).toBe("-last_message_at");
    expect(query(lastCall("/dashboard/chat/groups/")).has("reported")).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Reported chats only" }));
    expect(new URLSearchParams(store.search).get("has_open_reports")).toBe("true");
    await waitFor(() => expect(query(lastCall("/dashboard/chat/groups/")).get("reported")).toBe("1"));
  });
});

describe("lectures page filters", () => {
  it("maps subject, scope, status, publication and created range to the list request", async () => {
    hoisted.list.mockResolvedValue({ results: [], count: 0, next: null, previous: null });
    renderPage(<LecturesPage />, "subject=4&scope=general&status=ready&is_published=false&created_after=2026-01-01&created_before=2026-02-01&page=2&page_size=50");
    await waitFor(() => expect(hoisted.list).toHaveBeenCalled());
    expect(listFilters()).toMatchObject({ page: 2, pageSize: 50, filters: { subject: "4", scope: "general", status: "ready", is_published: "false", created_after: "2026-01-01", created_before: "2026-02-01" } });
    expect(await screen.findByTestId("filter-empty")).toBeTruthy();
  });
});

describe("verifications page filters", () => {
  it("sends status, semester and the submitted range", async () => {
    renderPage(<VerificationPage />, "status=pending&semester=2&created_after=2026-03-01&created_before=2026-03-31");
    await waitFor(() => expect(hoisted.list).toHaveBeenCalled());
    expect(listFilters()).toMatchObject({ page: 1, pageSize: 25, ordering: "-created_at", filters: { status: "pending", semester: "2", created_after: "2026-03-01", created_before: "2026-03-31" } });
  });
});

describe("enrollment review filters", () => {
  it("defaults to the pending queue and forwards faculty, year, semester, dates and search", async () => {
    renderPage(<EnrollmentReviewPage />);
    await waitFor(() => expect(lastCall("/enrollment/requests/")).not.toBe(""));
    expect(query(lastCall("/enrollment/requests/")).get("status")).toBe("pending");
    cleanup();
    hoisted.calls = [];
    renderPage(<EnrollmentReviewPage />, "status=all&faculty=2&academic_year=3&semester=1&created_after=2026-02-01&search=sara");
    await waitFor(() => expect(lastCall("/enrollment/requests/")).not.toBe(""));
    const params = query(lastCall("/enrollment/requests/"));
    expect(params.has("status")).toBe(false);
    expect(Object.fromEntries(params)).toMatchObject({ faculty: "2", academic_year: "3", semester: "1", created_after: "2026-02-01", search: "sara", page_size: "100", ordering: "-created_at" });
  });
});
