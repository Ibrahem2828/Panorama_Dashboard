/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/features/auth/login-form";
import { I18nProvider } from "@/i18n/provider";
import { AppApiError } from "@/lib/api/errors";

const hoisted = vi.hoisted(() => ({ error: null as unknown }));
vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "ar" }) }));
vi.mock("@/features/session", () => ({
  useLogin: () => ({ mutate: vi.fn(), isPending: false, isError: hoisted.error !== null, error: hoisted.error }),
}));

afterEach(cleanup);

function renderForm(initialIdentifier?: string) {
  render(<I18nProvider locale="ar"><LoginForm initialIdentifier={initialIdentifier} /></I18nProvider>);
}

describe("login form", () => {
  it("adds the new-account hint under the generic invalid-credentials message", () => {
    hoisted.error = new AppApiError({ status: 400, code: "LOGIN_UPSTREAM_REJECTED" });
    renderForm();
    expect(screen.getByTestId("login-error").textContent).toContain("غير صحيحة");
    expect(screen.getByTestId("login-error-hint").textContent).toBe("أنشأ لك المسؤول حسابًا حديثًا؟ إن حدّدت كلمة مرورك سابقًا فاستخدمها، وإلا اختر «نسيت كلمة المرور؟».");
  });

  it("does not add it to other failures, and prefills the e-mail passed from the invite page", () => {
    hoisted.error = new AppApiError({ status: 429, code: "LOGIN_UPSTREAM_REJECTED", retryAfter: 60 });
    renderForm("staff@example.com");
    expect(screen.queryByTestId("login-error-hint")).toBeNull();
    expect((document.getElementById("identifier") as HTMLInputElement).value).toBe("staff@example.com");
  });
});
