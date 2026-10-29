/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationBell } from "@/features/notifications/notification-bell";
import { ProfilePage } from "@/features/profile/profile-page";
import { I18nProvider } from "@/i18n/provider";

const calls: { path: string; init?: { method?: string; body?: unknown } }[] = [];
const json = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { "content-type": "application/json" } });

vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "ar" }), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("@/features/session", () => ({
  useSession: () => ({ user: { id: 1, full_name: "علي أحمد", email: "a@x.sy", role: "admin" } }),
  useCan: () => true,
}));
vi.mock("@/features/auth/public-auth", () => ({ ChangePasswordForm: () => <form aria-label="تغيير كلمة المرور" /> }));
vi.mock("@/lib/api/browser-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/browser-client")>("@/lib/api/browser-client");
  return {
    ...actual,
    apiFetch: vi.fn(async (path: string, init?: { method?: string; body?: unknown }) => {
      calls.push({ path, init });
      if (path.endsWith("/auth/me/") && init?.method === "PATCH") return json({ id: 1, full_name: "علي أحمد", job_title: (init.body as { job_title?: string }).job_title ?? "", email: "a@x.sy", phone_number: "0911", role: "admin" });
      if (path.endsWith("/auth/me/")) return json({ id: 1, full_name: "علي أحمد", job_title: "", email: "a@x.sy", phone_number: "0911", role: "admin" });
      if (path.endsWith("/notifications/summary/")) return json({ unread: 2, by_category: {} });
      if (path.includes("/notifications/?")) return json({ count: 1, results: [{ id: 3, title: "طلب جديد", body: "تفاصيل", category: "", type: "x", deep_link: "/dashboard/enrollment", is_read: false, created_at: "2026-10-29T10:00:00Z" }] });
      return json({});
    }),
  };
});

function renderWithProviders(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><I18nProvider locale="ar">{node}</I18nProvider></QueryClientProvider>);
}

beforeEach(() => { calls.length = 0; window.localStorage.clear(); document.title = "لوحة بانوراما"; });
afterEach(cleanup);

describe("profile page", () => {
  it("sends only the changed job title to PATCH auth/me and shows the read-only fields", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProfilePage />);
    const job = await screen.findByLabelText("المسمى الوظيفي");
    expect(screen.getByText("a@x.sy")).toBeTruthy();
    expect(screen.getByText("0911")).toBeTruthy();
    const save = screen.getByRole("button", { name: "حفظ" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await user.type(job, "مشرف الشؤون الأكاديمية");
    expect(save.disabled).toBe(false);
    await user.click(save);
    await waitFor(() => expect(calls.some((call) => call.init?.method === "PATCH")).toBe(true));
    expect(calls.find((call) => call.init?.method === "PATCH")?.init?.body).toEqual({ job_title: "مشرف الشؤون الأكاديمية" });
  });

  it("refuses an empty name without calling the API", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProfilePage />);
    const name = await screen.findByLabelText("الاسم الكامل");
    await user.clear(name);
    const save = screen.getByRole("button", { name: "حفظ" }) as HTMLButtonElement;
    await user.click(save);
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
    expect(calls.some((call) => call.init?.method === "PATCH")).toBe(false);
  });
});

describe("notification bell", () => {
  it("puts the unread count in the tab title and lets the user mute the chime (remembered)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationBell />);
    await waitFor(() => expect(document.title).toBe("(2) لوحة بانوراما"));
    await user.click(await screen.findByRole("button", { name: /الإشعارات: ٢/u }));
    const sound = await screen.findByRole("menuitemcheckbox", { name: /صوت التنبيه: يعمل/u });
    await user.click(sound);
    expect(window.localStorage.getItem("panorama.notifications.sound")).toBe("off");
    expect(await screen.findByRole("menuitemcheckbox", { name: /صوت التنبيه: مكتوم/u })).toBeTruthy();
  });
});
