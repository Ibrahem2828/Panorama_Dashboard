/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FinishedJobsPage } from "@/features/finance/finished-jobs-page";
import { I18nProvider } from "@/i18n/provider";

const fetchMock = vi.fn();
let canFinance = true;
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/features/session", () => ({ useCan: (capability?: string) => (capability === "finance.manage" ? canFinance : true) }));
vi.mock("@/lib/api/browser-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser-client")>()),
  apiFetch: (...args: unknown[]) => fetchMock(...args),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const unpaid = { id: 11, customer: "Ali", completed_at: "2026-10-10T10:00:00Z", files_count: 2, pages_count: 40, sheets_count: 20, total_price: "100.00", currency: "SYP", paid: "0.00", due: "100.00", is_paid: false };
const partial = { ...unpaid, id: 12, customer: "Sara", paid: "40.00", due: "60.00" };
const paid = { ...unpaid, id: 13, customer: "Omar", paid: "100.00", due: "0.00", is_paid: true };

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

beforeEach(() => {
  canFinance = true;
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (path: string) => {
    if (String(path).includes("printing/jobs")) return ok({ data: { count: 3, results: [unpaid, partial, paid], totals_by_currency: { SYP: { total: "300.00", orders: 3 } } } });
    return ok({ data: {} });
  });
});
afterEach(cleanup);

const renderPage = () => render(
  <I18nProvider locale="ar"><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FinishedJobsPage /></QueryClientProvider></I18nProvider>,
);

describe("finished print orders page", () => {
  it("shows Arabic payment pills, period totals and no raw English enum", async () => {
    renderPage();
    expect(await screen.findByText("Ali")).toBeTruthy();
    expect(screen.getByText("غير مدفوع")).toBeTruthy();
    expect(screen.getByText("مدفوع جزئيًا")).toBeTruthy();
    expect(screen.getByText("مدفوع")).toBeTruthy();
    expect(screen.getAllByText(/300 ل\.س/u).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/\bSYP\b/u);
  });

  it("offers a payment only while something is due, with the amount defaulting to the due amount", async () => {
    renderPage();
    await screen.findByText("Sara");
    expect(screen.getAllByRole("button", { name: "تسجيل دفعة" })).toHaveLength(2);
    await userEvent.click(screen.getAllByRole("button", { name: "تسجيل دفعة" })[1]!);
    expect((await screen.findByLabelText(/المبلغ/u) as HTMLInputElement).value).toBe("60.00");
    await userEvent.click(screen.getByRole("button", { name: "تسجيل الدفعة" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([path, init]) => String(path).includes("printing/payments") && (init as { method?: string })?.method === "POST")).toBe(true));
    const post = fetchMock.mock.calls.find(([, init]) => (init as { method?: string })?.method === "POST")!;
    expect((post[1] as { body: unknown }).body).toEqual({ order: 12, amount: "60.00", method: "cash" });
  });

  it("rejects an amount above what is due", async () => {
    renderPage();
    await screen.findByText("Ali");
    await userEvent.click(screen.getAllByRole("button", { name: "تسجيل دفعة" })[0]!);
    const input = await screen.findByLabelText(/المبلغ/u);
    await userEvent.clear(input);
    await userEvent.type(input, "150");
    await userEvent.click(screen.getByRole("button", { name: "تسجيل الدفعة" }));
    expect(await screen.findByText("المبلغ أكبر من المتبقي على الطلب.")).toBeTruthy();
  });

  it("shows the void action only to finance managers and only when something was paid", async () => {
    renderPage();
    await screen.findByText("Ali");
    expect(screen.getAllByRole("button", { name: "إلغاء الدفعة" })).toHaveLength(2);
    cleanup();
    canFinance = false;
    renderPage();
    await screen.findByText("Ali");
    expect(screen.queryByRole("button", { name: "إلغاء الدفعة" })).toBeNull();
  });
});
