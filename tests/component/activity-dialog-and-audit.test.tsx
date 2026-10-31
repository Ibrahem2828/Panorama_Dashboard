/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RESOURCE_COLUMNS } from "@/features/resources/columns";
import { UserActivityDialog } from "@/features/users/staff-onboarding";
import { I18nProvider } from "@/i18n/provider";
import { AppApiError } from "@/lib/api/errors";

const hoisted = vi.hoisted(() => ({
  activity: {} as Record<string, unknown>,
  resend: { message: "أُرسل رابط جديد.", data: { purpose: "invite", email_sent: true } } as Record<string, unknown>,
  resendError: null as unknown,
  posts: [] as string[],
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: hoisted.toast }));
vi.mock("@/lib/api/browser-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser-client")>()),
  apiFetch: vi.fn(async (path: string, init: { method?: string } = {}) => {
    if (init.method === "POST") {
      hoisted.posts.push(path);
      if (hoisted.resendError) throw hoisted.resendError;
      return { json: async () => hoisted.resend };
    }
    return { json: async () => ({ data: hoisted.activity }) };
  }),
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

beforeEach(() => { hoisted.posts = []; hoisted.resendError = null; hoisted.resend = { message: "أُرسل رابط جديد.", data: { purpose: "invite", email_sent: true } }; Object.values(hoisted.toast).forEach((mock) => mock.mockClear()); Element.prototype.hasPointerCapture ??= () => false; Element.prototype.scrollIntoView ??= () => undefined; });
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
    expect(screen.getByTestId("invitation-state").textContent).toContain("بانتظار القبول");
    // the existing actions are kept, once each
    expect(screen.getAllByRole("button", { name: /إعادة إرسال/u })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /إلغاء الدعوة/u })).toHaveLength(1);
  });

  it("states of an accepted invitation hide the revoke action; older backends fall back to the previous line", async () => {
    hoisted.activity = { ...base, invitation: { state: "accepted" }, recent_logins: [] };
    renderDialog();
    expect((await screen.findByTestId("invitation-state")).textContent).toContain("قُبلت الدعوة");
    expect(screen.queryByRole("button", { name: /إلغاء الدعوة/u })).toBeNull();
    expect(screen.getByText("لا توجد محاولات دخول مسجّلة.")).toBeTruthy();
    cleanup();
    hoisted.activity = { ...base, invitation_pending: true, invitation_expires_at: "2026-11-05T10:00:00Z" };
    renderDialog();
    expect(await screen.findByText(/دعوة بانتظار القبول/u)).toBeTruthy();
    expect(screen.queryByTestId("recent-logins")).toBeNull();
  });
});

describe("invitation line and action button by state", () => {
  const reset = () => screen.queryByRole("button", { name: "إرسال رابط إعادة تعيين كلمة المرور" });
  const resend = () => screen.queryByRole("button", { name: "إعادة إرسال الدعوة" });

  it("pending: waiting line with expiry, resend + revoke", async () => {
    hoisted.activity = { ...base, invitation_expires_at: "2026-11-05T10:00:00Z", invitation: { state: "pending", purpose: "invite" } };
    renderDialog();
    expect((await screen.findByTestId("invitation-state")).textContent).toContain("بانتظار القبول");
    expect(resend()).toBeTruthy();
    expect(reset()).toBeNull();
    expect(screen.getByRole("button", { name: "إلغاء الدعوة" })).toBeTruthy();
  });

  it("accepted: shows the acceptance date, the reset button and no revoke", async () => {
    hoisted.activity = { ...base, invitation: { state: "accepted", accepted_at: "2026-10-30T09:00:00Z", password_set: true } };
    renderDialog();
    expect((await screen.findByTestId("invitation-state")).textContent).toMatch(/^قبلت الدعوة في /u);
    expect(reset()).toBeTruthy();
    expect(resend()).toBeNull();
    expect(screen.queryByRole("button", { name: "إلغاء الدعوة" })).toBeNull();
  });

  it.each([["expired", "انتهت صلاحية الدعوة"], ["revoked", "أُلغيت الدعوة"]])("%s: line + resend, no revoke", async (state, line) => {
    hoisted.activity = { ...base, invitation: { state } };
    renderDialog();
    expect((await screen.findByTestId("invitation-state")).textContent).toBe(line);
    expect(resend()).toBeTruthy();
    expect(screen.queryByRole("button", { name: "إلغاء الدعوة" })).toBeNull();
  });

  it("delivery failed is a visible warning; delivery ok shows the send time", async () => {
    hoisted.activity = { ...base, invitation: { state: "pending", delivery: { status: "failed", sent_at: null, error: "smtp" } } };
    renderDialog();
    expect((await screen.findByTestId("invitation-delivery-failed")).textContent).toContain("تعذّر إرسال البريد — تأكد من العنوان أو أعد الإرسال");
    cleanup();
    hoisted.activity = { ...base, invitation: { state: "pending", delivery: { status: "ok", sent_at: "2026-10-30T09:00:00Z" } } };
    renderDialog();
    expect((await screen.findByTestId("invitation-delivery-ok")).textContent).toMatch(/^أُرسلت في /u);
    expect(screen.queryByTestId("invitation-delivery-failed")).toBeNull();
  });

  it("accepted: asks for confirmation before sending the reset link, and does nothing when declined", async () => {
    hoisted.activity = { ...base, invitation: { state: "accepted", password_set: true } };
    hoisted.resend = { message: "أُرسل رابط إعادة تعيين كلمة المرور.", data: { purpose: "reset", email_sent: true } };
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "إرسال رابط إعادة تعيين كلمة المرور" }));
    expect(confirm.mock.calls[0]?.[0]).toContain("ستبقى كلمة مرورها الحالية صالحة حتى تحدّد كلمة جديدة");
    expect(hoisted.posts).toHaveLength(0);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "إرسال رابط إعادة تعيين كلمة المرور" }));
    await waitFor(() => expect(hoisted.toast.success).toHaveBeenCalledWith("أُرسل رابط إعادة تعيين كلمة المرور."));
    expect(hoisted.posts[0]).toContain("/resend-invitation/");
    confirm.mockRestore();
  });

  it("email_sent=false shows the warning toast instead of a success", async () => {
    hoisted.activity = { ...base, invitation: { state: "expired" } };
    hoisted.resend = { message: "تم", data: { purpose: "invite", email_sent: false } };
    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "إعادة إرسال الدعوة" }));
    await waitFor(() => expect(hoisted.toast.warning).toHaveBeenCalledWith("أُنشئ الرابط لكن تعذّر إرسال البريد"));
    expect(hoisted.toast.success).not.toHaveBeenCalled();
  });

  it("a refusal shows the server's Arabic message, never the generic failure", async () => {
    hoisted.activity = { ...base, invitation: { state: "expired" } };
    hoisted.resendError = new AppApiError({ status: 400, code: "USER_INACTIVE", message: "الحساب غير مفعّل من قبل المسؤول." });
    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "إعادة إرسال الدعوة" }));
    await waitFor(() => expect(hoisted.toast.error).toHaveBeenCalledWith("الحساب غير مفعّل من قبل المسؤول."));
    expect(hoisted.toast.error).not.toHaveBeenCalledWith("تعذر تنفيذ العملية. حاول مرة أخرى.");
  });

  it("recent actions show action_label, and a local Arabic name for the invitation actions without one", async () => {
    hoisted.activity = {
      ...base, invitation: { state: "accepted" },
      recent_actions: [
        { id: 1, action: "user_invitation_accepted", action_label: "قبول الدعوة (من الخادم)", target_type: "user", target_id: "9", ip_address: null, created_at: "2026-10-30T09:00:00Z" },
        { id: 2, action: "user_invitation_accepted", target_type: "user", target_id: "9", ip_address: null, created_at: "2026-10-30T08:00:00Z" },
        { id: 3, action: "user_sessions_ended", target_type: "user", target_id: "9", ip_address: null, created_at: "2026-10-30T07:00:00Z" },
      ],
    };
    renderDialog();
    expect(await screen.findByText("قبول الدعوة (من الخادم)")).toBeTruthy();
    expect(screen.getByText("قبول الدعوة وتعيين كلمة المرور")).toBeTruthy();
    expect(screen.getByText("إنهاء جلسات المستخدم")).toBeTruthy();
    expect(screen.queryByText("غير معروف")).toBeNull();
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
