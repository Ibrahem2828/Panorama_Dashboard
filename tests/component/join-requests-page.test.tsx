/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GroupMembersDialog } from "@/features/groups/group-members-dialog";
import { JoinRequestsPage } from "@/features/groups/join-requests-page";
import type { JoinRequestRow } from "@/features/groups/join-requests-rules";
import { I18nProvider } from "@/i18n/provider";
import { createNavigationStore } from "../helpers/navigation-mock";

interface Call { url: string; method: string; body?: unknown }
const hoisted = vi.hoisted(() => ({
  store: null as null | { search: string; set: (next: string) => void; subscribe: (listener: () => void) => () => void },
  caps: new Set<string>(),
  calls: [] as { url: string; method: string; body?: unknown }[],
  handler: null as null | ((call: { url: string; method: string; body?: unknown }) => unknown),
}));
vi.mock("next/navigation", async () => {
  const react = await import("react");
  return {
    useSearchParams: () => {
      const text = react.useSyncExternalStore((listener) => hoisted.store!.subscribe(listener), () => hoisted.store!.search, () => hoisted.store!.search);
      return new URLSearchParams(text);
    },
    useRouter: () => ({ replace: (url: string) => hoisted.store!.set(url), push: vi.fn() }),
    usePathname: () => "/ar/dashboard/groups/requests",
  };
});
vi.mock("@/features/session", () => ({ useCan: (capability?: string) => !capability || hoisted.caps.has(capability) }));
vi.mock("@/lib/api/browser-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser-client")>()),
  apiFetch: vi.fn(async (url: string, init: { method?: string; body?: unknown } = {}) => {
    const call = { url, method: init.method ?? "GET", body: init.body };
    hoisted.calls.push(call);
    const payload = hoisted.handler!(call) as Record<string, unknown>;
    return { ...payload, json: async () => payload };
  }),
}));

const row = (id: number, over: Partial<JoinRequestRow> = {}): JoinRequestRow => ({
  id, created_at: new Date(Date.now() - 3_600_000).toISOString(), status: "pending",
  user: { id: 40 + id, full_name: `طالب ${id}`, email: `s${id}@example.com`, student_number: `2026${id}`, verification_status: "approved" },
  group: { id: 9, name: "مجموعة الرياضيات", kind: "subject", subject: { id: 3, name: "رياضيات 1" }, faculty: { id: 2, name: "الهندسة" }, academic_year: "الأولى", semester: "الأول" },
  reviewed_by: null, reviewed_at: null, note: "", ...over,
});
let rows: JoinRequestRow[] = [];
let bulkResponse: unknown = [];
const summary = { pending: 14, approved_today: 3, rejected_today: 1 };

function route(call: Call): unknown {
  if (call.method === "POST" && call.url.includes("/bulk-decision/")) return { data: bulkResponse };
  if (call.method === "POST") return { data: { ok: true } };
  if (call.url.includes("/group-join-requests/summary/")) return { data: summary };
  if (call.url.includes("/group-join-requests/")) return { data: { count: rows.length, next: null, previous: null, results: rows } };
  return { data: { count: 0, next: null, previous: null, results: [] } };
}
const lastGet = (fragment: string) => [...hoisted.calls].reverse().find((call) => call.method === "GET" && call.url.includes(fragment));
const query = (url: string | undefined) => new URLSearchParams((url ?? "").split("?")[1] ?? "");
const bulkCall = () => hoisted.calls.find((call) => call.url.includes("/bulk-decision/"));

function renderUi(ui: React.ReactElement, search = "") {
  hoisted.store = createNavigationStore(search);
  render(<I18nProvider locale="ar"><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider></I18nProvider>);
}

beforeEach(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  hoisted.calls = [];
  hoisted.handler = route;
  hoisted.caps = new Set(["groups.manage"]);
  rows = [row(1), row(2, { group: { ...row(2).group, kind: "faculty", subject: null, name: "مجتمع الهندسة" } })];
  bulkResponse = [];
});
afterEach(cleanup);

describe("group join requests page", () => {
  it("is guarded by the group management capability", () => {
    hoisted.caps = new Set();
    renderUi(<JoinRequestsPage />);
    expect(screen.queryByTestId("join-requests-banner")).toBeNull();
    expect(hoisted.calls).toHaveLength(0);
  });

  it("explains that joining now goes through subject registration and links to that review page", async () => {
    renderUi(<JoinRequestsPage />);
    const banner = await screen.findByTestId("join-requests-banner");
    expect(banner.textContent).toContain("يدخل الطلاب المجموعات تلقائيًا بعد قبول طلب تسجيل المواد، ولم يعد بإمكانهم طلب الانضمام يدويًا. تظهر هنا الطلبات القديمة المعلّقة فقط.");
    expect(within(banner).getByRole("link", { name: /طلبات تسجيل المواد/u }).getAttribute("href")).toBe("/ar/dashboard/enrollment");
  });

  it("loads the pending queue by default and shows the summary counters and the pending badge", async () => {
    renderUi(<JoinRequestsPage />);
    await screen.findByTestId("join-request-1");
    const params = query(lastGet("/group-join-requests/?")?.url);
    expect(params.get("status")).toBe("pending");
    expect(params.get("ordering")).toBe("-created_at");
    await waitFor(() => expect(screen.getByTestId("join-summary-pending").textContent).toContain("١٤"));
    expect(screen.getByTestId("join-summary-approvedToday").textContent).toContain("٣");
    expect(screen.getByTestId("join-summary-rejectedToday").textContent).toContain("١");
    expect(screen.getByRole("button", { name: /بانتظار/u, pressed: true }).textContent).toContain("١٤");
  });

  it("renders the student, group, kind, subject and a profile link", async () => {
    renderUi(<JoinRequestsPage />);
    const first = await screen.findByTestId("join-request-1");
    expect(within(first).getByRole("link", { name: "طالب 1" }).getAttribute("href")).toBe("/ar/dashboard/users/41");
    expect(within(first).getByText("20261")).toBeTruthy();
    expect(within(first).getByText("مجموعة الرياضيات")).toBeTruthy();
    expect(within(first).getByText("رياضيات 1")).toBeTruthy();
    expect(within(first).getByText("مجموعات مواد")).toBeTruthy();
    expect(first.querySelector("time")?.getAttribute("title")).toBeTruthy();
  });

  it("sends every filter from the URL as a request parameter (list and summary without the status)", async () => {
    renderUi(<JoinRequestsPage />, "?status=approved&group=9&faculty=2&academic_year=1&semester=1&kind=subject&subject=3&created_after=2026-10-01&created_before=2026-10-31&search=sara");
    await screen.findByTestId("join-request-1");
    expect(Object.fromEntries(query(lastGet("/group-join-requests/?")?.url))).toMatchObject({
      status: "approved", group: "9", faculty: "2", academic_year: "1", semester: "1", kind: "subject", subject: "3",
      created_after: "2026-10-01", created_before: "2026-10-31", search: "sara", ordering: "-created_at", page: "1",
    });
    const summaryParams = query(lastGet("/group-join-requests/summary/")?.url);
    expect(summaryParams.get("group")).toBe("9");
    expect(summaryParams.has("status")).toBe(false);
    expect(summaryParams.has("page")).toBe(false);
  });

  it("switching to the approved segment asks for approved requests and offers no decisions on them", async () => {
    rows = [row(5, { status: "approved", reviewed_by: { id: 7, full_name: "سارة المشرفة" }, reviewed_at: new Date().toISOString() })];
    renderUi(<JoinRequestsPage />);
    await screen.findByTestId("join-request-5");
    await userEvent.click(screen.getByRole("button", { name: /مقبولة/u }));
    await waitFor(() => expect(query(lastGet("/group-join-requests/?")?.url).get("status")).toBe("approved"));
    const approved = await screen.findByTestId("join-request-5");
    expect(within(approved).getByText("سارة المشرفة")).toBeTruthy();
    expect(within(approved).queryByRole("button")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("shows an empty state when nothing is pending", async () => {
    rows = [];
    renderUi(<JoinRequestsPage />);
    expect((await screen.findByTestId("filter-empty")).textContent).toContain("لا توجد طلبات انضمام معلّقة");
  });

  it("approves one request through the membership action and refreshes", async () => {
    renderUi(<JoinRequestsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "قبول: طالب 1" }));
    await waitFor(() => expect(hoisted.calls.some((call) => call.method === "POST" && call.url === "/api/v1/dashboard/group-memberships/1/approve/")).toBe(true));
    await waitFor(() => expect(hoisted.calls.filter((call) => call.method === "GET" && call.url.includes("/group-join-requests/?")).length).toBeGreaterThan(1));
  });

  it("rejects one request with an optional reason", async () => {
    renderUi(<JoinRequestsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "رفض: طالب 2" }));
    await userEvent.type(await screen.findByLabelText("سبب الرفض"), "مجموعة غير مناسبة");
    await userEvent.click(screen.getByRole("button", { name: "رفض" }));
    await waitFor(() => expect(hoisted.calls.find((call) => call.method === "POST")).toMatchObject({ url: "/api/v1/dashboard/group-memberships/2/reject/", body: { note: "مجموعة غير مناسبة" } }));
  });

  it("rejects without a reason (it is optional)", async () => {
    renderUi(<JoinRequestsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "رفض: طالب 1" }));
    await userEvent.click(await screen.findByRole("button", { name: "رفض" }));
    await waitFor(() => expect(hoisted.calls.find((call) => call.method === "POST")).toMatchObject({ url: "/api/v1/dashboard/group-memberships/1/reject/", body: undefined }));
  });

  it("selects rows, approves them in bulk and reports success", async () => {
    bulkResponse = [{ id: 1, ok: true }, { id: 2, ok: true }];
    renderUi(<JoinRequestsPage />);
    await userEvent.click(await screen.findByRole("checkbox", { name: "تحديد كل الطلبات في الصفحة" }));
    const bar = await screen.findByTestId("bulk-bar");
    expect(bar.textContent).toContain("٢ محدد");
    await userEvent.click(within(bar).getByRole("button", { name: "قبول المحدد" }));
    await waitFor(() => expect(bulkCall()).toMatchObject({ method: "POST", body: { ids: [1, 2], decision: "approve" } }));
    expect(screen.queryByTestId("bulk-results")).toBeNull();
  });

  it("bulk rejects with a reason and lists the items that failed", async () => {
    bulkResponse = [{ id: 1, ok: true }, { id: 2, ok: false, error: "already_decided" }];
    renderUi(<JoinRequestsPage />);
    await userEvent.click(await screen.findByRole("checkbox", { name: "طالب 1" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "طالب 2" }));
    await userEvent.click(within(await screen.findByTestId("bulk-bar")).getByRole("button", { name: "رفض المحدد" }));
    await userEvent.type(await screen.findByLabelText("سبب الرفض"), "انتهت المدة");
    await userEvent.click(screen.getByRole("button", { name: "رفض" }));
    await waitFor(() => expect(bulkCall()).toMatchObject({ body: { ids: [1, 2], decision: "reject", note: "انتهت المدة" } }));
    const results = await screen.findByTestId("bulk-results");
    expect(within(results).getByTestId("bulk-failure-2").textContent).toContain("طالب 2");
    expect(within(results).queryByTestId("bulk-failure-1")).toBeNull();
    expect(results.textContent).toContain("١ من ٢");
  });

  it("marks the deep-linked request", async () => {
    renderUi(<JoinRequestsPage />, "?highlight=2");
    expect((await screen.findByTestId("join-request-2")).getAttribute("data-highlighted")).toBe("true");
    expect(screen.getByTestId("join-request-1").getAttribute("data-highlighted")).toBeNull();
  });
});

describe("group members dialog: join requests pointer", () => {
  it("replaces the requests tab by a pointer to the new screen filtered to the group, without approve/reject UI", async () => {
    renderUi(<GroupMembersDialog group={{ id: 9, name: "مجموعة الرياضيات" }} onOpenChange={() => undefined} />);
    await userEvent.click(await screen.findByRole("tab", { name: "طلبات الانضمام" }));
    const pointer = await screen.findByTestId("requests-pointer");
    expect(within(pointer).getByRole("link").getAttribute("href")).toBe("/ar/dashboard/groups/requests?group=9");
    expect(screen.queryByRole("button", { name: "قبول" })).toBeNull();
    expect(screen.queryByRole("button", { name: "رفض" })).toBeNull();
    expect(hoisted.calls.some((call) => call.url.includes("/join-requests/"))).toBe(false);
  });

  it("opens on the members tab and loads the memberships endpoint", async () => {
    renderUi(<GroupMembersDialog group={{ id: 9, name: "مجموعة الرياضيات" }} onOpenChange={() => undefined} />);
    await waitFor(() => expect(hoisted.calls.some((call) => call.url.includes("/groups/9/memberships/"))).toBe(true));
    expect(screen.queryByTestId("requests-pointer")).toBeNull();
  });
});
