/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FeedbackPage } from "@/features/feedback/feedback-page";
import { I18nProvider } from "@/i18n/provider";

const calls: string[] = [];
vi.mock("@/features/session", () => ({ useCan: () => true, useSession: () => ({ user: { id: 1, role: "admin" } }) }));
vi.mock("@/features/staff/use-assignees", () => ({ useAssignees: () => ({ options: [], limited: false }) }));
vi.mock("@/lib/api/browser-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser-client")>()),
  apiFetch: vi.fn(async (url: string) => {
    calls.push(url);
    if (url.includes("feedback-analytics")) {
      return Response.json({ data: { average_rating: 3.84, total_ratings: 10, total_feedback: 12, rating_distribution: { "1": 1, "3": 2, "4": 3, "5": 4 } } });
    }
    const item = (id: number, over: Record<string, unknown>) => ({ id, user_name: "علي", kind: "rating", metric_type: "", title: "t" + id, comment: "", suggestion: "", status: "new", priority: "normal", internal_notes: "", resolution_message: "", platform: "android", app_version: "1.0", locale: "ar", votes_count: 0, created_at: "2026-10-01", ...over });
    return { data: { count: 3, results: [item(1, { rating: 4 }), item(2, { rating: 1 }), item(3, { rating: null, metric_type: "nps", metric_value: 9 })] } };
  }),
}));

afterEach(() => { cleanup(); calls.length = 0; });

function renderPage() {
  return render(<I18nProvider locale="ar"><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FeedbackPage /></QueryClientProvider></I18nProvider>);
}

describe("FeedbackPage rating display", () => {
  it("shows smiley faces in the list instead of stars or numbers, and keeps non-CSAT metrics numeric", async () => {
    renderPage();
    const faces = await screen.findAllByTestId("rating-face");
    expect(faces.map((face) => face.getAttribute("aria-label"))).toEqual(["التقييم: جيد (4 من 5)", "التقييم: حزين جدًا (1 من 5)"]);
    const rows = screen.getAllByRole("row");
    expect(within(rows[3]).queryByTestId("rating-face")).toBeNull();
    expect(rows[3].textContent).toContain("٩");
    expect(document.querySelector("svg.lucide-star")).toBeNull();
  });

  it("offers a rating filter (no rating param until one is chosen)", async () => {
    renderPage();
    await screen.findAllByTestId("rating-face");
    expect(screen.getByRole("combobox", { name: "التقييم" })).toBeTruthy();
    expect(calls.some((url) => url.includes("/feedback/?") && !url.includes("rating="))).toBe(true);
  });

  it("summary shows average face, numeric average and distribution counts", async () => {
    renderPage();
    await screen.findAllByTestId("rating-face");
    await userEvent.click(screen.getByRole("tab", { name: /التحليلات/u }));
    await waitFor(() => expect(screen.getByTestId("rating-summary")).toBeTruthy());
    expect(screen.getByTestId("rating-average").textContent).toBe("٣٫٨");
    expect(within(screen.getByTestId("rating-dist-5")).getByText("٤")).toBeTruthy();
    expect(within(screen.getByTestId("rating-dist-2")).getByText("٠")).toBeTruthy();
  });
});
