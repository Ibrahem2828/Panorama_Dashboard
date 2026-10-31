/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RESOURCE_COLUMNS } from "@/features/resources/columns";
import { UserActivityDialog } from "@/features/users/staff-onboarding";
import { I18nProvider } from "@/i18n/provider";

const hoisted = vi.hoisted(() => ({ activity: {} as Record<string, unknown> }));
vi.mock("@/lib/api/browser-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser-client")>()),
  apiFetch: vi.fn(async () => ({ json: async () => ({ data: hoisted.activity }) })),
}));

const base = {
  last_login: "2026-10-30T09:00:00Z", last_password_change_at: null, active_sessions: 1, must_change_password: false,
  invitation_pending: false, invitation_expires_at: null, recent_actions: [],
};

function renderDialog() {
  render(
    <I18nProvider locale="ar">
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <UserActivityDialog user={{ id: 9, full_name: "موظف جديد" }} onClose={() => undefined} />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

beforeEach(() => { Element.prototype.hasPointerCapture ??= () => false; Element.prototype.scrollIntoView ??= () => undefined; });
afterEach(cleanup);

describe("users activity dialog", () => {
  it("shows the latest sign-in attempts with a Arabic reason badge for failures, and the invitation state", async () => {
    hoisted.activity = {
      ...base,
      invitation: { state: "pending", mode: "link", last_sent_at: "2026-10-29T10:00:00Z" },
      invitation_pending: true,
      invitation_expires_at: "2026-11-05T10:00:00Z",
      recent_logins: [
        { at: "2026-10-30T09:00:00Z", kind: "login_failed", ip: "203.0.113.9", reason: "unverified" },
        { at: "2026-10-30T08:00:00Z", kind: "login_success", ip: "10.0.0.1", reason: null },
      ],
    };
    renderDialog();
    const logins = await screen.findByTestId("recent-logins");
    expect(within(logins).getByText("آخر محاولات الدخول")).toBeTruthy();
    expect(within(logins).getByTestId("login-reason").textContent).toBe("حساب غير موثّق");
    expect(within(logins).getByText("203.0.113.9")).toBeTruthy();
    expect(within(logins).getByText("10.0.0.1")).toBeTruthy();
    expect(within(logins).getByText("فشل")).toBeTruthy();
    expect(within(logins).getByText("نجاح")).toBeTruthy();
    expect(screen.getByTestId("invitation-state").textContent).toContain("الدعوة: بانتظار القبول");
    // the existing actions are kept, once each
    expect(screen.getAllByRole("button", { name: /إعادة إرسال/u })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /إلغاء الدعوة/u })).toHaveLength(1);
  });

  it("states of an accepted invitation hide the revoke action; older backends fall back to the previous line", async () => {
    hoisted.activity = { ...base, invitation: { state: "accepted" }, recent_logins: [] };
    renderDialog();
    expect((await screen.findByTestId("invitation-state")).textContent).toContain("تم القبول");
    expect(screen.queryByRole("button", { name: /إلغاء الدعوة/u })).toBeNull();
    expect(screen.getByText("لا توجد محاولات دخول مسجّلة.")).toBeTruthy();
    cleanup();
    hoisted.activity = { ...base, invitation_pending: true, invitation_expires_at: "2026-11-05T10:00:00Z" };
    renderDialog();
    expect(await screen.findByText(/دعوة بانتظار القبول/u)).toBeTruthy();
    expect(screen.queryByTestId("recent-logins")).toBeNull();
  });
});

describe("audit log columns", () => {
  const columns = RESOURCE_COLUMNS["audit-logs"]!;
  const actor = columns.find((column) => column.key === "actor")!;
  const target = columns.find((column) => column.key === "target_id")!;

  it("keeps the original columns", () => {
    expect(columns.map((column) => column.key)).toEqual(["id", "actor", "action", "target_type", "target_id", "created_at"]);
  });

  it("shows the actor as a profile link and the target label next to its id, with fallbacks to the bare ids", () => {
    render(
      <I18nProvider locale="ar">
        <div data-testid="a">{actor.render!(5, { actor_detail: { id: 5, full_name: "علي المدير", email: "a@x.com", role: "admin" } })}</div>
        <div data-testid="b">{actor.render!(6, { actor_detail: null })}</div>
        <div data-testid="c">{target.render!("12", { target_label: "ملف المحاضرة" })}</div>
        <div data-testid="d">{target.render!("12", { target_label: null })}</div>
      </I18nProvider>,
    );
    expect(within(screen.getByTestId("a")).getByRole("link", { name: "علي المدير" }).getAttribute("href")).toBe("/ar/dashboard/users/5");
    expect(screen.getByTestId("b").textContent).toBe("6");
    expect(screen.getByTestId("c").textContent).toContain("ملف المحاضرة");
    expect(screen.getByTestId("c").textContent).toContain("#12");
    expect(screen.getByTestId("d").textContent).toBe("12");
  });
});
