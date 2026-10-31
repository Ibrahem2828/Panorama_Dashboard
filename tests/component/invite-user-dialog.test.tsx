/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InviteUserDialog } from "@/features/users/staff-onboarding";
import { I18nProvider } from "@/i18n/provider";

const hoisted = vi.hoisted(() => ({
  invite: { data: { id: 21, email_sent: true } } as Record<string, unknown>,
  resend: { data: { purpose: "invite", email_sent: true } } as Record<string, unknown>,
  posts: [] as string[],
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: hoisted.toast }));
vi.mock("@/lib/api/browser-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/browser-client")>()),
  apiFetch: vi.fn(async (path: string, init: { method?: string } = {}) => {
    if (init.method === "POST") { hoisted.posts.push(path); return { json: async () => (path.includes("/invite/") ? hoisted.invite : hoisted.resend) }; }
    return new Response(JSON.stringify({ data: { count: 1, next: null, previous: null, results: [{ id: 1, key: "k", name_ar: "قالب", name_en: "Template", description: "", role: "staff", capabilities: [], is_system: false, is_active: true, warnings: [] }] } }));
  }),
}));

function renderDialog() {
  render(
    <I18nProvider locale="ar">
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <InviteUserDialog onClose={() => undefined} />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

async function submit() {
  fireEvent.change(await screen.findByLabelText("الاسم الكامل"), { target: { value: "موظفة جديدة" } });
  fireEvent.change(screen.getByLabelText("البريد الإلكتروني"), { target: { value: "new@example.com" } });
  fireEvent.change(screen.getByLabelText("رقم الهاتف"), { target: { value: "+963900000000" } });
  await userEvent.click(await screen.findByRole("combobox"));
  await userEvent.click(await screen.findByRole("option", { name: "قالب" }));
  fireEvent.click(screen.getByRole("button", { name: "إرسال الدعوة" }));
}

beforeEach(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.scrollIntoView ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  hoisted.posts = [];
  hoisted.invite = { data: { id: 21, email_sent: true } };
  Object.values(hoisted.toast).forEach((mock) => mock.mockClear());
});
afterEach(cleanup);

describe("invite user dialog", () => {
  it("explains both entry modes in one line each", async () => {
    renderDialog();
    expect(await screen.findByText(/يحدّد الموظف كلمة مروره بنفسه/u)).toBeTruthy();
    expect(screen.getByText(/تصله بالبريد ويُغيّرها عند أول دخول/u)).toBeTruthy();
  });

  it("confirms who the invitation was sent to", async () => {
    renderDialog();
    await submit();
    expect((await screen.findByTestId("invite-result")).textContent).toContain("أُرسلت الدعوة إلى new@example.com");
    expect(screen.queryByTestId("invite-result-warning")).toBeNull();
  });

  it("email_sent=false shows an explicit warning with a retry that reuses resend", async () => {
    hoisted.invite = { data: { id: 21, email_sent: false } };
    renderDialog();
    await submit();
    expect((await screen.findByTestId("invite-result-warning")).textContent).toContain("تعذّر إرسال البريد إلى new@example.com");
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    await waitFor(() => expect(hoisted.posts.some((path) => path.endsWith("/users/21/resend-invitation/"))).toBe(true));
    await waitFor(() => expect(screen.getByTestId("invite-result")).toBeTruthy());
  });
});
