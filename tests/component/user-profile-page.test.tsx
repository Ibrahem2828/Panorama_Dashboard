/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UserProfilePage } from "@/features/users/user-profile-page";
import type { StudentDetail } from "@/features/users/user-profile-rules";
import { I18nProvider } from "@/i18n/provider";

const replace = vi.fn();
const search = { tab: null as string | null };
const calls: { path: string; method?: string }[] = [];
let detailPayload: unknown;
let failDetail = false;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/ar/dashboard/users/9",
  useSearchParams: () => ({ get: (key: string) => (key === "tab" ? search.tab : null) }),
}));
vi.mock("@/features/session", () => ({
  useCan: () => true,
  useSession: () => ({ user: { id: 1, role: "it_support" } }),
}));
vi.mock("@/lib/api/browser-client", () => ({
  apiFetch: async (path: string, init?: { method?: string }) => {
    calls.push({ path, method: init?.method });
    if (path.endsWith("/student-detail/")) { if (failDetail) throw new Error("boom"); return detailPayload; }
    if (path.endsWith("/users/9/")) return { role: "student", is_active: true };
    return {};
  },
  unwrap: async (value: unknown) => value,
}));

const detail: StudentDetail = {
  user: { id: 9, full_name: "علي الأحمد", email: "ali@example.com", phone_number: "0933000000", job_title: "ممثل الدفعة", is_active: true, last_login: null, created_at: "2026-01-01T00:00:00Z" },
  profile: { faculty: { id: 1, name: "كلية الطب" }, academic_year: { id: 2, name: "السنة الثانية" }, student_number: "123456", verification_status: "approved" },
  groups: [{ membership_id: 70, group_id: 4, group_name: "مجموعة الفيزياء", role: "member", status: "approved", joined_at: "2026-02-01T00:00:00Z" }],
  enrollments: [{ id: 3, status: "pending", created_at: "2026-02-01T00:00:00Z", items: [{ subject: { id: 1, name: "فيزياء 1" }, status: "pending" }] }],
  files: [], print_orders: [], support_tickets: [], verification_history: [],
  counts: { groups: 1, enrollments: 1 },
};

function view() {
  return render(
    <I18nProvider locale="ar">
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <UserProfilePage userId={9} />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

beforeEach(() => { calls.length = 0; replace.mockClear(); search.tab = null; failDetail = false; detailPayload = detail; });
afterEach(cleanup);

describe("UserProfilePage", () => {
  it("renders the header with name, job title and the academic overview", async () => {
    view();
    expect(await screen.findByRole("heading", { name: "علي الأحمد" })).toBeTruthy();
    expect(screen.getAllByText("ممثل الدفعة").length).toBeGreaterThan(0);
    expect(screen.getByText("كلية الطب")).toBeTruthy();
    expect(screen.getByText("123456")).toBeTruthy();
  });

  it("offers deactivate and unlock but not activate for an active student", async () => {
    view();
    await screen.findByRole("heading", { name: "علي الأحمد" });
    await waitFor(() => expect(screen.getByRole("button", { name: "تعطيل الحساب" })).toBeTruthy());
    expect(screen.getByRole("button", { name: "فتح قفل الدخول" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "تفعيل الحساب" })).toBeNull();
  });

  it("opens the tab named in ?tab= and lists the memberships with their actions", async () => {
    search.tab = "groups";
    view();
    expect(await screen.findByText("مجموعة الفيزياء")).toBeTruthy();
    expect(screen.getByRole("button", { name: /طرد|إزالة/ })).toBeTruthy();
  });

  it("writes the selected tab to the URL", async () => {
    view();
    const tab = await screen.findByRole("tab", { name: /الملفات/ });
    fireEvent.mouseDown(tab);
    fireEvent.click(tab);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ar/dashboard/users/9?tab=files", { scroll: false }));
  });

  it("shows empty states per tab", async () => {
    search.tab = "orders";
    view();
    expect(await screen.findByText("لا طلبات طباعة.")).toBeTruthy();
  });

  it("shows an error panel with retry when loading fails", async () => {
    failDetail = true;
    view();
    expect(await screen.findByRole("button", { name: /إعادة المحاولة/ })).toBeTruthy();
  });
});
