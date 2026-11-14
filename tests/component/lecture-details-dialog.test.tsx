/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LectureDetailsDialog } from "@/features/lectures/lecture-details-dialog";
import type { LectureRow } from "@/features/lectures/lecture-rules";
import { I18nProvider } from "@/i18n/provider";

let allowed = false;
const fetchMock = vi.fn();
vi.mock("@/features/session", () => ({ useCan: () => allowed }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/api/browser-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser-client")>()),
  apiFetch: (...args: unknown[]) => fetchMock(...args),
}));

afterEach(() => { cleanup(); allowed = false; fetchMock.mockReset(); });

const general: LectureRow = { id: 9, subject: null, subject_name: null, faculty: null, faculty_name: null, is_general: true, title: "Orientation", status: "ready", is_published: false };

function show(lecture: LectureRow, locale: "ar" | "en" = "ar") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><I18nProvider locale={locale}><LectureDetailsDialog lecture={lecture} now={Date.now()} onOpenChange={() => undefined} /></I18nProvider></QueryClientProvider>);
}

describe("lecture details for a general lecture", () => {
  it("never prints #null: shows 'محاضرة عامة' and 'كل الكليات'", () => {
    show(general);
    expect(screen.getByText("محاضرة عامة")).toBeTruthy();
    expect(screen.getByText("كل الكليات")).toBeTruthy();
    expect(document.body.textContent).not.toContain("null");
  });

  it("shows the faculty name of a faculty-scoped general lecture", () => {
    show({ ...general, faculty: 3, faculty_name: "كلية الهندسة" });
    expect(screen.getByText("كلية الهندسة")).toBeTruthy();
  });

  it("shows the subject name of a subject lecture", () => {
    show({ ...general, is_general: false, subject: 4, subject_name: "الخوارزميات", faculty_name: "كلية الهندسة" });
    expect(screen.getByText("الخوارزميات")).toBeTruthy();
  });
});

describe("offline licenses panel in the lecture details", () => {
  it("is hidden and makes no request without lectures.manage", () => {
    show(general);
    expect(screen.queryByText("التنزيلات بدون إنترنت")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the active license count of the lecture and links to the student profiles", async () => {
    allowed = true;
    const rows = [
      { license_id: "a", lecture_id: 9, user_id: 5, state: "active" },
      { license_id: "b", lecture_id: 9, user_id: 5, state: "active" },
      { license_id: "c", lecture_id: 9, user_id: 6, state: "revoked" },
    ];
    fetchMock.mockResolvedValue({ json: async () => ({ data: rows }) });
    show(general);
    expect(await screen.findByText(/[2٢] ترخيص نشط لدى [1١] طالب/)).toBeTruthy();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/dashboard/lectures/offline-licenses/?lecture=9");
    expect(screen.getByRole("link", { name: "#5" }).getAttribute("href")).toContain("/dashboard/users/5?tab=offline");
  });
});
