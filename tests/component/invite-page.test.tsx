/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AcceptInvitation } from "@/features/auth/accept-invitation";
import { I18nProvider } from "@/i18n/provider";
import { AppApiError } from "@/lib/api/errors";

const hoisted = vi.hoisted(() => ({
  info: { state: "valid" } as Record<string, unknown>,
  infoError: null as unknown,
  accept: null as unknown,
  calls: [] as { path: string; body: unknown }[],
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "ar" }), useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/api/browser-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser-client")>()),
  bffFetch: vi.fn(async (path: string, init: { body?: unknown } = {}) => {
    hoisted.calls.push({ path, body: init.body });
    if (path.endsWith("invitation-info")) {
      if (hoisted.infoError) throw hoisted.infoError;
      return { json: async () => ({ data: hoisted.info }) };
    }
    if (hoisted.accept instanceof Error) throw hoisted.accept;
    return { json: async () => ({ data: hoisted.accept }) };
  }),
}));

const STRONG = "Correct-horse-42";

function renderPage() {
  render(<I18nProvider locale="ar"><AcceptInvitation token={"t".repeat(32)} /></I18nProvider>);
}
const passwordInputs = () => [document.getElementById("invite-password") as HTMLInputElement, document.getElementById("invite-confirm") as HTMLInputElement];

async function fillAndSubmit(password = STRONG, confirm = STRONG) {
  await screen.findByRole("button", { name: "تعيين كلمة المرور" });
  const [first, second] = passwordInputs();
  fireEvent.change(first!, { target: { value: password } });
  fireEvent.change(second!, { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "تعيين كلمة المرور" }));
}

beforeEach(() => { hoisted.info = { state: "valid", full_name: "موظفة" }; hoisted.infoError = null; hoisted.accept = { email: "staff@example.com" }; hoisted.calls = []; });
afterEach(cleanup);

describe("invite page by state", () => {
  it("valid: asks the server first, then renders the password form with a live rules hint", async () => {
    renderPage();
    expect(await screen.findByLabelText("كلمة المرور الجديدة")).toBeTruthy();
    expect(hoisted.calls[0]?.path).toBe("/api/auth/public/invitation-info");
    const rules = screen.getByRole("list", { name: "شروط كلمة المرور" });
    expect(rules.querySelectorAll('[data-ok="true"]')).toHaveLength(0);
    const [first, second] = passwordInputs();
    fireEvent.change(first!, { target: { value: STRONG } });
    fireEvent.change(second!, { target: { value: STRONG } });
    expect(rules.querySelectorAll('[data-ok="true"]')).toHaveLength(3);
  });

  it.each([
    ["expired", "انتهت صلاحية رابط الدعوة. اطلب من المسؤول إرسال رابط جديد."],
    ["revoked", "رابط الدعوة غير صالح. اطلب من المسؤول رابطًا جديدًا."],
    ["unknown", "رابط الدعوة غير صالح. اطلب من المسؤول رابطًا جديدًا."],
  ])("%s: explains the problem and never renders the password form", async (state, text) => {
    hoisted.info = { state };
    renderPage();
    expect(await screen.findByText(text)).toBeTruthy();
    expect(document.getElementById("invite-password")).toBeNull();
    expect(screen.queryByRole("button", { name: "تعيين كلمة المرور" })).toBeNull();
    expect(document.querySelector("form")).toBeNull();
  });

  it("an unrecognised state is treated as unusable, not as a form", async () => {
    hoisted.info = { state: "something-new" };
    renderPage();
    expect(await screen.findByText("رابط الدعوة غير صالح. اطلب من المسؤول رابطًا جديدًا.")).toBeTruthy();
    expect(document.querySelector("form")).toBeNull();
  });

  it("accepted: shows the masked e-mail with sign-in and forgot-password buttons, and no form", async () => {
    hoisted.info = { state: "accepted", email_masked: "s***@example.com" };
    renderPage();
    expect(await screen.findByText(/تم تعيين كلمة المرور لهذا الحساب بالفعل\. سجّل الدخول بالبريد \(s\*\*\*@example\.com\) وكلمة المرور التي اخترتها\./u)).toBeTruthy();
    expect(screen.getByRole("link", { name: "تسجيل الدخول" }).getAttribute("href")).toBe("/ar/login");
    expect(screen.getByRole("link", { name: "نسيت كلمة المرور؟" }).getAttribute("href")).toBe("/ar/forgot-password");
    expect(document.querySelector("form")).toBeNull();
  });

  it("a network failure offers a retry instead of a form", async () => {
    hoisted.infoError = new AppApiError({ status: 503, code: "BACKEND_NETWORK_UNAVAILABLE" });
    renderPage();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(document.querySelector("form")).toBeNull();
    hoisted.infoError = null;
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(await screen.findByLabelText("كلمة المرور الجديدة")).toBeTruthy();
  });
});

describe("accepting the invitation", () => {
  it("success: shows the done screen and a sign-in link carrying only the e-mail (no token, no password)", async () => {
    renderPage();
    await fillAndSubmit();
    expect(await screen.findByText("تم تعيين كلمة المرور")).toBeTruthy();
    const href = screen.getByRole("link", { name: "تسجيل الدخول" }).getAttribute("href") ?? "";
    expect(href).toBe("/ar/login?email=staff%40example.com");
    expect(href).not.toContain("ttttt");
    expect(href).not.toContain(STRONG);
    expect(document.querySelector("form")).toBeNull();
  });

  it.each([
    ["INVITATION_ACCEPTED_ALREADY", "تم تعيين كلمة المرور لهذا الحساب بالفعل."],
    ["INVITATION_EXPIRED", "انتهت صلاحية رابط الدعوة."],
    ["INVITATION_REVOKED", "رابط الدعوة غير صالح."],
    ["INVITATION_INVALID", "رابط الدعوة غير صالح."],
  ])("%s switches the page to the matching state, never the generic bad-request text", async (code, text) => {
    hoisted.accept = new AppApiError({ status: 400, code, message: "رسالة من الخادم" });
    renderPage();
    await fillAndSubmit();
    expect(await screen.findByText(new RegExp(text, "u"))).toBeTruthy();
    expect(screen.queryByText(/الطلب غير صالح/u)).toBeNull();
    expect(document.querySelector("form")).toBeNull();
  });

  it("password policy errors stay on the form as clear Arabic field messages", async () => {
    hoisted.accept = new AppApiError({ status: 400, code: "VALIDATION_ERROR", errors: { password: ["كلمة المرور شائعة جدًا."] } });
    renderPage();
    await fillAndSubmit();
    expect((await screen.findByRole("alert")).textContent).toContain("كلمة المرور شائعة جدًا.");
    expect(screen.queryByText(/الطلب غير صالح/u)).toBeNull();
    expect(document.getElementById("invite-password")).toBeTruthy();
  });

  it("a password error without an Arabic message falls back to a clear sentence", async () => {
    hoisted.accept = new AppApiError({ status: 400, code: "VALIDATION_ERROR", errors: { password: ["This password is too common."] } });
    renderPage();
    await fillAndSubmit();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("كلمة المرور غير مقبولة"));
  });

  it("checks the match client-side before calling the server", async () => {
    renderPage();
    await fillAndSubmit(STRONG, "Different-pass-1");
    expect((await screen.findByRole("alert")).textContent).toContain("غير متطابقتين");
    expect(hoisted.calls.some((call) => call.path.endsWith("invitation-accept"))).toBe(false);
  });
});
