/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CounterOrderTab } from "@/features/printing/counter-order-page";
import { JobQueuePanel } from "@/features/printing/job-queue-panel";
import { PricingSimulator } from "@/features/printing/pricing-simulator";
import { PrintersPanel } from "@/features/printing/printers-panel";
import { I18nProvider } from "@/i18n/provider";

const fetchMock = vi.fn();
vi.mock("@/lib/api/browser-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser-client")>()),
  apiFetch: (...args: unknown[]) => fetchMock(...args),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const job = (over: Record<string, unknown>) => ({ id: 1, order_id: 7, item: 1, item_name: "lecture.pdf", status: "queued", printer_name: "HP-Front", sides_printed: 4, sheets: 2, error: "", created_at: "2026-10-29T10:00:00Z", ...over });
const jobs = [job({ id: 1 }), job({ id: 2, status: "failed", error: "paper jam", printer_name: "Canon" }), job({ id: 3, status: "done" })];
const options = { data: { currency: "SYP", pages_per_sheet: [1, 2, 4, 6, 9, 16], binding_types: [{ code: "wire9", name: "تسليك خاص" }], covers: [{ code: "blue", name: "غلاف أزرق", price_per_copy: "500.00" }] } };

beforeEach(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (path: string) => {
    const url = String(path);
    if (url.includes("print-jobs")) return ok({ data: { count: jobs.length, results: jobs } });
    if (url.includes("printing/options")) return ok(options);
    if (url.includes("printing/products")) return ok({ data: { count: 0, results: [] } });
    if (url.includes("counter-orders/quote")) return ok({ data: { complete: true, exact_total: "1004.00", suggested_total: "1000.00", rounding_adjustment: "-4.00", items: [{ pages_count: 10, sheets_count: 3, unit_price: "504.00", binding_price: "500.00", subtotal: "1004.00", unavailable: null }] } });
    if (url.includes("printing/orders/9/")) return ok({ data: { id: 9, items: [{ original_file_name: "book.pdf", pages_count: 30, selected_pages: 20, copies: 2, color_mode: "black_white", paper_size: "A4", sides: "double_sided", binding: "none", pages_per_sheet: 2, cover: "" }] } });
    return ok({ data: {} });
  });
});
afterEach(cleanup);

const wrap = (node: React.ReactNode) => render(
  <I18nProvider locale="ar"><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider></I18nProvider>,
);

describe("live print queue", () => {
  const renderQueue = (onChange = vi.fn()) => { wrap(<JobQueuePanel status="all" orderFilter="" page={1} pageSize={25} onChange={onChange} />); return onChange; };

  it("lists jobs of every order with a link to the order and the right actions per status", async () => {
    renderQueue();
    expect(await screen.findAllByText("lecture.pdf")).toHaveLength(3);
    const links = screen.getAllByRole("link", { name: "#7" });
    expect(links[0]?.getAttribute("href")).toBe("/ar/dashboard/printing?tab=orders&order=7");
    const rows = screen.getAllByRole("row").slice(1);
    // queued: open + done + failed; failed: retry; done: reprint only
    expect(within(rows[0]!).getByRole("button", { name: /فتح/u })).toBeTruthy();
    expect(within(rows[1]!).getByRole("button", { name: /إعادة المحاولة/u })).toBeTruthy();
    expect(within(rows[1]!).getByText("paper jam")).toBeTruthy();
    expect(within(rows[2]!).queryByRole("button", { name: /فتح/u })).toBeNull();
    expect(within(rows[2]!).getByRole("button", { name: /طباعة مرة أخرى/u })).toBeTruthy();
  });

  it("re-queues a failed job through the retry endpoint", async () => {
    renderQueue();
    await screen.findAllByText("lecture.pdf");
    await userEvent.click(screen.getByRole("button", { name: /إعادة المحاولة/u }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([path, init]) => String(path).endsWith("/print-jobs/2/retry/") && (init as { method?: string })?.method === "POST")).toBe(true));
  });

  it("asks the server for the chosen status and order only", async () => {
    wrap(<JobQueuePanel status="failed" orderFilter="7" page={2} pageSize={25} onChange={vi.fn()} />);
    await screen.findAllByText("lecture.pdf");
    const url = String(fetchMock.mock.calls.find(([path]) => String(path).includes("page=2"))?.[0]);
    expect(url).toContain("status=failed");
    expect(url).toContain("order=7");
  });

  it("shows an empty state", async () => {
    fetchMock.mockImplementation(async () => ok({ data: { count: 0, results: [] } }));
    renderQueue();
    expect(await screen.findByText("لا توجد مهام طباعة بهذه التصفية.")).toBeTruthy();
  });
});

describe("printers tab", () => {
  it("says plainly that the server has no printer registry and summarises printers from jobs", async () => {
    wrap(<PrintersPanel />);
    expect(screen.getByText("إدارة الطابعات والمحطات غير متاحة بعد في الخادم")).toBeTruthy();
    expect(await screen.findByText("HP-Front")).toBeTruthy();
    expect(screen.getByText("Canon")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /إضافة|تعطيل/u })).toBeNull();
  });
});

describe("pricing simulator", () => {
  it("quotes the typed options without creating anything", async () => {
    wrap(<PricingSimulator />);
    await userEvent.type(screen.getByLabelText(/عدد الصفحات/u, { selector: "input" }), "10");
    await waitFor(() => expect(screen.getByText("السعر بعد التقريب")).toBeTruthy());
    expect(fetchMock.mock.calls.some(([, init]) => (init as { method?: string })?.method === "POST" && String((init as { body?: unknown }).body ?? "").length > 0)).toBe(true);
    expect(fetchMock.mock.calls.some(([path]) => String(path).endsWith("/counter-orders/"))).toBe(false);
  });

  it("offers every pages-per-sheet value, the shop's covers and custom binding types", async () => {
    wrap(<PricingSimulator />);
    const group = await screen.findByRole("radiogroup", { name: "صفحات في الورقة الواحدة" });
    expect(within(group).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["1", "2", "4", "6", "9", "16"]);
    expect(await screen.findByRole("option", { name: /غلاف أزرق/u })).toBeTruthy();
    expect(await screen.findByRole("radio", { name: /تسليك خاص/u })).toBeTruthy();
  });
});

describe("counter tab", () => {
  it("pre-fills the form from an existing order and says so", async () => {
    wrap(<CounterOrderTab copyFrom={9} />);
    expect(await screen.findByText(/تم نسخ خيارات الطلب رقم 9/u)).toBeTruthy();
    expect((screen.getByLabelText(/عدد الصفحات/u, { selector: "input" }) as HTMLInputElement).value).toBe("20");
    expect(screen.getByLabelText("وصف الملف", { exact: false })).toBeTruthy();
    expect((screen.getByLabelText("وصف الملف", { exact: false }) as HTMLInputElement).value).toBe("book.pdf");
  });

  it("starts empty with a shortcut hint when no order is copied", async () => {
    wrap(<CounterOrderTab copyFrom={null} />);
    expect(await screen.findByText(/Ctrl \+ Enter/u)).toBeTruthy();
    expect((screen.getByLabelText(/عدد الصفحات/u, { selector: "input" }) as HTMLInputElement).value).toBe("");
  });
});
