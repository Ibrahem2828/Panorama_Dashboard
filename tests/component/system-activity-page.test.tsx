/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SystemActivityPage } from "@/features/system-activity/system-activity-page";
import type { ActivityRow, ActivityUserRollup } from "@/features/system-activity/rules";
import { I18nProvider } from "@/i18n/provider";
import { AppApiError } from "@/lib/api/errors";
import { createNavigationStore } from "../helpers/navigation-mock";

const hoisted = vi.hoisted(() => ({
  store: null as null | { search: string; set: (next: string) => void; subscribe: (listener: () => void) => () => void },
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
    useRouter: () => ({ replace: (url: string) => hoisted.store!.set(url), push: vi.fn() }),
    usePathname: () => "/ar/dashboard/system/activity",
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

const admin = { id: 7, full_name: "سارة المشرفة", email: "sara@example.com", role: "admin", job_title: "مسؤولة الدعم" };
const row = (id: number, over: Partial<ActivityRow> = {}): ActivityRow => ({
  id, created_at: new Date(Date.now() - 5 * 60_000).toISOString(), user: admin, user_label: admin.full_name, kind: "request", action_label: "عرض قائمة الطلاب",
  method: "GET", route: "/api/v1/dashboard/students/", status_code: 200, object_type: null, object_id: null, ip: "10.0.0.5", user_agent: "Mozilla/5.0 Test", duration_ms: 42, extra: null, ...over,
});
const failed = row(2, {
  user: null, user_label: "s***@example.com", kind: "login_failed", action_label: "محاولة دخول فاشلة", method: "POST", route: "/api/v1/auth/login/", status_code: 400,
  extra: { reason: "password_not_set", identifier_masked: "s***@example.com" }, ip: "203.0.113.9",
});
const rollup: ActivityUserRollup = { user: admin, last_activity_at: new Date(Date.now() - 3_600_000).toISOString(), requests_24h: 120, requests_7d: 900, failed_logins_24h: 3, last_action_label: "تعديل مستخدم", last_ip: "10.0.0.5" };
const summary = { total: 1234, errors: 56, failed_logins: 7, active_users: 18, by_kind: { request: 1000, login_success: 200, login_failed: 7, logout: 20, denied: 7 } };

let rows: ActivityRow[] = [];
let listError = false;
function route(url: string): unknown {
  if (url.includes("/system-activity/summary/")) return { data: summary };
  if (url.includes("/system-activity/users/")) return { data: { count: 1, next: null, previous: null, results: [rollup] } };
  if (url.includes("/system-activity/")) {
    if (listError) throw new AppApiError({ status: 500, code: "SERVER_ERROR", message: "boom" } as never);
    return { data: { count: rows.length, next: null, previous: null, results: rows } };
  }
  return { data: { count: 0, results: [] } };
}
const lastCall = (fragment: string) => [...hoisted.calls].reverse().find((url) => url.includes(fragment)) ?? "";
const query = (url: string) => new URLSearchParams(url.split("?")[1] ?? "");

function renderPage(search = "") {
  const store = createNavigationStore(search);
  hoisted.store = store;
  render(
    <I18nProvider locale="ar">
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SystemActivityPage /></QueryClientProvider>
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
  hoisted.caps = new Set(["audit.view"]);
  rows = [row(1), failed];
  listError = false;
});
afterEach(cleanup);

describe("system activity page", () => {
  it("is guarded by the audit capability", () => {
    hoisted.caps = new Set();
    renderPage();
    expect(screen.queryByRole("tab", { name: /السجل المباشر/u })).toBeNull();
  });

  it("shows the live feed: who, what they asked, outcome, address, and the five counters", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: "سارة المشرفة" });
    expect(link.getAttribute("href")).toBe("/ar/dashboard/users/7");
    const first = link.closest("tr") as HTMLElement;
    expect(within(first).getByText("عرض قائمة الطلاب")).toBeTruthy();
    expect(within(first).getByText("GET /api/v1/dashboard/students/")).toBeTruthy();
    expect(within(first).getByText(/مسؤولة الدعم/u)).toBeTruthy();
    expect(within(first).getByTestId("outcome-badge").textContent).toBe("200");
    expect(within(first).getByText("10.0.0.5")).toBeTruthy();
    expect(first.querySelector("time")?.getAttribute("title")).toBeTruthy();
    for (const key of ["total", "activeUsers", "errors", "failedLogins", "denied"]) expect(await screen.findByTestId(`summary-${key}`)).toBeTruthy();
    expect((await screen.findByTestId("summary-failedLogins")).textContent).toBe("٧");
  });

  it("highlights a failed login with its Arabic reason and masked identifier", async () => {
    renderPage();
    const badge = await screen.findByTestId("login-reason");
    expect(badge.textContent).toBe("لم تُقبل الدعوة بعد / لا توجد كلمة مرور");
    expect(badge.getAttribute("data-reason")).toBe("password_not_set");
    const tableRow = badge.closest("tr") as HTMLElement;
    expect(within(tableRow).getAllByText("s***@example.com").length).toBeGreaterThan(0);
    expect(within(tableRow).getByTestId("outcome-badge").textContent).toBe("400");
    expect(tableRow.getAttribute("data-kind")).toBe("login_failed");
  });

  it("sends the filters from the URL as request parameters (list and summary)", async () => {
    renderPage("?user=7&kind=login_failed&outcome=error&role=admin&method=POST&route=/api/v1/auth/login/&created_after=2026-10-01&created_before=2026-10-31&search=sara");
    await screen.findByTestId("login-reason");
    const params = query(lastCall("/system-activity/?"));
    expect(Object.fromEntries(params)).toMatchObject({
      user: "7", kind: "login_failed", outcome: "error", role: "admin", method: "POST", route: "/api/v1/auth/login/",
      created_after: "2026-10-01", created_before: "2026-10-31", search: "sara", ordering: "-created_at", page: "1",
    });
    const summaryParams = query(lastCall("/system-activity/summary/"));
    expect(summaryParams.get("kind")).toBe("login_failed");
    expect(summaryParams.get("user")).toBe("7");
    expect(summaryParams.has("page")).toBe(false);
  });

  it("opens the full detail with user agent and extra data", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /عرض التفاصيل: محاولة دخول فاشلة/u }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Mozilla/5.0 Test")).toBeTruthy();
    expect(within(dialog).getByText(/identifier_masked/u)).toBeTruthy();
    expect(within(dialog).getByTestId("login-reason")).toBeTruthy();
  });

  it("deep-links the users tab and jumps to the live feed filtered to that user", async () => {
    const store = renderPage("?tab=users");
    const card = (await screen.findByTestId("user-rollup")).querySelector("li") as HTMLElement;
    expect(within(card).getByText("سارة المشرفة").closest("a")?.getAttribute("href")).toBe("/ar/dashboard/users/7");
    expect(within(card).getByTestId("failed-24h").textContent).toContain("٣");
    expect(within(card).getByText("١٢٠")).toBeTruthy();
    expect(query(lastCall("/system-activity/users/")).get("ordering")).toBe("-last_activity_at");
    await userEvent.click(within(card).getByRole("button", { name: /عرض سجله/u }));
    expect(new URLSearchParams(store.search).get("user")).toBe("7");
    expect(new URLSearchParams(store.search).has("tab")).toBe(false);
    expect(await screen.findByRole("tab", { name: /السجل المباشر/u, selected: true })).toBeTruthy();
    expect(query(lastCall("/system-activity/?")).get("user")).toBe("7");
  });

  it("switches tabs through the URL", async () => {
    const store = renderPage();
    await screen.findByTestId("login-reason");
    await userEvent.click(screen.getByRole("tab", { name: /المستخدمون/u }));
    expect(new URLSearchParams(store.search).get("tab")).toBe("users");
    expect(await screen.findByTestId("user-rollup")).toBeTruthy();
  });

  it("shows empty and error states", async () => {
    rows = [];
    renderPage();
    expect(await screen.findByText("لا يوجد نشاط مسجّل بعد.")).toBeTruthy();
    cleanup();
    listError = true;
    renderPage();
    expect(await screen.findByRole("button", { name: "إعادة المحاولة" })).toBeTruthy();
  });
});
