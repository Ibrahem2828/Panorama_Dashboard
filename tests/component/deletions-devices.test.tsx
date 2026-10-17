/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DeletionsPage } from "@/features/governance/deletions-page";
import { DevicesPage } from "@/features/product/devices-page";
import { I18nProvider } from "@/i18n/provider";

const listMock = vi.fn();
const fetchMock = vi.fn();
let role = "admin";
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/features/session", () => ({ useCan: () => true, useSession: () => ({ user: { role } }) }));
vi.mock("@/features/resources/resource-api", () => ({ listResource: (...args: unknown[]) => listMock(...args) }));
vi.mock("@/lib/api/browser-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser-client")>()),
  apiFetch: (...args: unknown[]) => fetchMock(...args),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const user = { id: 5, full_name: "Ali Student", email: "ali@example.com", role: "student" };
const deletion = { id: 1, user, status: "requested", requested_at: "2026-10-01T10:00:00Z", scheduled_for: "2026-10-31T10:00:00Z", cancelled_at: null, completed_at: null, reason: "leaving", days_remaining: 14 };
const cancelled = { ...deletion, id: 2, status: "cancelled", days_remaining: null };
const device = { id: 9, user, platform: "android", app_version: "1.4.0", build_number: 12, device_model: "Pixel 8", last_seen_at: "2026-10-10T10:00:00Z", notifications_enabled: true, is_revoked: false };
const revokedDevice = { ...device, id: 10, is_revoked: true };

beforeEach(() => {
  role = "admin";
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  listMock.mockReset();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (path: string) => {
    const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    if (String(path).includes("devices/stats")) return ok({ data: { total: 3, active: 2, revoked: 1, push_enabled: 2, by_platform: [{ platform: "android", count: 2 }], top_versions: [{ app_version: "1.4.0", count: 2 }] } });
    if (/account-deletions\/1\/$/u.test(String(path))) return ok({ data: { ...deletion, timeline: [{ at: "2026-10-01T10:00:00Z", action: "account_deletion_requested", actor: "Ali Student", note: null }] } });
    return ok({ data: {} });
  });
});
afterEach(cleanup);

const renderPage = (node: React.ReactNode) => render(
  <I18nProvider locale="ar"><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider></I18nProvider>,
);

async function openMenu(text: string, index = 0) {
  const row = (await screen.findAllByText(text))[index]!.closest("tr") as HTMLElement;
  await userEvent.click(row.querySelector('button[aria-label="الإجراءات"]') as HTMLElement);
}

describe("account deletions page", () => {
  it("shows Arabic status pills and offers cancel and execute only for a pending request", async () => {
    listMock.mockResolvedValue({ results: [deletion, cancelled], count: 2, next: null, previous: null });
    renderPage(<DeletionsPage />);
    expect((await screen.findAllByText("بانتظار التنفيذ")).length).toBeGreaterThan(0);
    await openMenu("بانتظار التنفيذ");
    expect(screen.getByRole("menuitem", { name: "إلغاء الطلب" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "تنفيذ الحذف الآن" })).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    await openMenu("ملغى");
    expect(screen.queryByRole("menuitem", { name: "إلغاء الطلب" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "تنفيذ الحذف الآن" })).toBeNull();
  });

  it("hides immediate execution from a non-admin role", async () => {
    role = "support_staff";
    listMock.mockResolvedValue({ results: [deletion], count: 1, next: null, previous: null });
    renderPage(<DeletionsPage />);
    await openMenu("بانتظار التنفيذ");
    expect(screen.getByRole("menuitem", { name: "إلغاء الطلب" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "تنفيذ الحذف الآن" })).toBeNull();
  });

  it("cancel needs a reason of at least 5 characters and posts it", async () => {
    listMock.mockResolvedValue({ results: [deletion], count: 1, next: null, previous: null });
    renderPage(<DeletionsPage />);
    await openMenu("بانتظار التنفيذ");
    await userEvent.click(screen.getByRole("menuitem", { name: "إلغاء الطلب" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent === "إلغاء الطلب") as HTMLElement;
    const reason = screen.getByLabelText(/سبب الإلغاء/u);
    await userEvent.type(reason, "abc");
    await userEvent.click(confirm);
    expect(fetchMock.mock.calls.some(([path]) => String(path).endsWith("/cancel/"))).toBe(false);
    await userEvent.type(reason, "de");
    await userEvent.click(confirm);
    await waitFor(() => expect(fetchMock.mock.calls.some(([path]) => String(path) === "/api/v1/dashboard/account-deletions/1/cancel/")).toBe(true));
    const call = fetchMock.mock.calls.find(([path]) => String(path).endsWith("/cancel/"))!;
    expect((call[1] as { body: unknown }).body).toEqual({ reason: "abcde" });
  });

  it("execute needs a reason and the typed account e-mail before it is enabled", async () => {
    listMock.mockResolvedValue({ results: [deletion], count: 1, next: null, previous: null });
    renderPage(<DeletionsPage />);
    await openMenu("بانتظار التنفيذ");
    await userEvent.click(screen.getByRole("menuitem", { name: "تنفيذ الحذف الآن" }));
    const dialog = await screen.findByRole("dialog");
    const button = dialog.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText(/سبب التنفيذ/u), "verified request");
    expect(button.disabled).toBe(true);
    const email = screen.getByLabelText(/اكتب البريد الإلكتروني للحساب/u);
    await userEvent.type(email, "wrong@example.com");
    expect(button.disabled).toBe(true);
    await userEvent.clear(email);
    await userEvent.type(email, "ALI@example.com");
    expect(button.disabled).toBe(false);
    await userEvent.click(button);
    await waitFor(() => expect(fetchMock.mock.calls.some(([path]) => String(path) === "/api/v1/dashboard/account-deletions/1/execute/")).toBe(true));
    const call = fetchMock.mock.calls.find(([path]) => String(path).endsWith("/execute/"))!;
    expect((call[1] as { body: unknown }).body).toEqual({ reason: "verified request", confirm_email: "ALI@example.com" });
  });

  it("opens the detail drawer with the timeline", async () => {
    listMock.mockResolvedValue({ results: [deletion], count: 1, next: null, previous: null });
    renderPage(<DeletionsPage />);
    await openMenu("بانتظار التنفيذ");
    await userEvent.click(screen.getByRole("menuitem", { name: "التفاصيل" }));
    expect(await screen.findByText("طلب الحذف")).toBeTruthy();
    expect(screen.getByText("الخط الزمني")).toBeTruthy();
  });
});

describe("devices page", () => {
  it("shows stats cards, Arabic platform labels, and revoke only for active devices", async () => {
    listMock.mockResolvedValue({ results: [device, revokedDevice], count: 2, next: null, previous: null });
    renderPage(<DevicesPage />);
    expect(await screen.findByText("إجمالي الأجهزة")).toBeTruthy();
    expect((await screen.findAllByText("أندرويد")).length).toBeGreaterThan(0);
    const rows = await screen.findAllByText("Pixel 8");
    expect(rows.length).toBe(2);
    await userEvent.click((rows[0]!.closest("tr") as HTMLElement).querySelector('button[aria-label="الإجراءات"]') as HTMLElement);
    expect(screen.getByRole("menuitem", { name: "إلغاء الجهاز" })).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    await userEvent.click((rows[1]!.closest("tr") as HTMLElement).querySelector('button[aria-label="الإجراءات"]') as HTMLElement);
    expect(screen.queryByRole("menuitem", { name: "إلغاء الجهاز" })).toBeNull();
  });
});
