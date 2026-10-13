/** @vitest-environment jsdom */
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ManagerRowAction } from "@/features/resources/resource-manager";
import { UsersPage } from "@/features/users/users-page";
import { I18nProvider } from "@/i18n/provider";

const captured: { actions: ManagerRowAction[] } = { actions: [] };
const sessionUser = { id: 2, role: "admin" };

vi.mock("@/features/resources/resource-manager", () => ({
  ResourceManager: (props: { rowActions?: ManagerRowAction[] }) => {
    captured.actions = props.rowActions ?? [];
    return null;
  },
}));
vi.mock("@/features/session", () => ({ useSession: () => ({ user: sessionUser }) }));

function unlockAction(locale: "en" | "ar" = "en"): ManagerRowAction {
  render(<I18nProvider locale={locale}><UsersPage /></I18nProvider>);
  const action = captured.actions.find((item) => item.key === "unlock-login");
  if (!action) throw new Error("unlock-login action missing");
  return action;
}

describe("users unlock-login row action", () => {
  beforeEach(() => {
    captured.actions = [];
    sessionUser.id = 2;
    sessionUser.role = "admin";
  });

  it("is visible for targets the actor outranks and hidden for self and peers", () => {
    const action = unlockAction();
    expect(action.visible?.({ id: 10, role: "student", is_active: true })).toBe(true);
    expect(action.visible?.({ id: 11, role: "support_staff", is_active: false })).toBe(true);
    expect(action.visible?.({ id: 2, role: "admin" })).toBe(false);
    expect(action.visible?.({ id: 3, role: "admin" })).toBe(false);
    expect(action.visible?.({ id: 4, role: "it_support" })).toBe(false);
  });

  it("lets IT Support unlock anyone except itself", () => {
    sessionUser.id = 1;
    sessionUser.role = "it_support";
    const action = unlockAction();
    expect(action.visible?.({ id: 4, role: "it_support" })).toBe(true);
    expect(action.visible?.({ id: 1, role: "it_support" })).toBe(false);
  });

  it("posts to the unlock endpoint behind a confirmation without a reason field", () => {
    const action = unlockAction();
    expect(action.request({ id: 10 })).toEqual({ path: "/api/v1/dashboard/users/10/unlock-login/", method: "POST", body: {} });
    expect(action.reason).toBeUndefined();
    expect(action.destructive).toBeFalsy();
    expect(action.confirm.description({ id: 10, full_name: "Sara" })).toContain("Sara");
    expect(action.confirm.description({ id: 10, full_name: "Sara" })).toContain("immediately");
  });

  it("is localized in Arabic", () => {
    const action = unlockAction("ar");
    expect(action.label).toBe("فتح قفل الدخول");
  });
});
