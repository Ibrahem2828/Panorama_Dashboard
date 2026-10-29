import { describe, expect, it } from "vitest";

import { capabilityForDashboardPath } from "@/config/navigation";

describe("canonical dashboard route capabilities", () => {
  it("maps locale-prefixed direct routes to their required capability", () => {
    expect(capabilityForDashboardPath("/ar/dashboard/printing")).toBe("printing.manage");
    expect(capabilityForDashboardPath("/en/dashboard/academic/universities")).toBe("academic.manage");
  });

  it("does not infer a capability for an unknown route", () => {
    expect(capabilityForDashboardPath("/en/dashboard/unknown")).toBeUndefined();
  });
});

describe("students navigation entry", () => {
  it("opens for user managers or verification reviewers and nobody else", async () => {
    const { allNavigationItems, navigationItemAllowed } = await import("@/config/navigation");
    const students = allNavigationItems.find((item) => item.key === "students")!;
    expect(students.href).toBe("/dashboard/students");
    expect(navigationItemAllowed(students, ["users.manage"])).toBe(true);
    expect(navigationItemAllowed(students, ["verification.review"])).toBe(true);
    expect(navigationItemAllowed(students, ["*"])).toBe(true);
    expect(navigationItemAllowed(students, ["files.manage", "dashboard.access"])).toBe(false);
    // The page gates itself on the same list, so the shell must not demand a single capability.
    expect(capabilityForDashboardPath("/ar/dashboard/students")).toBeUndefined();
  });

  it("stays distinct from the staff page and is listed once", async () => {
    const { allNavigationItems } = await import("@/config/navigation");
    const { messages } = await import("@/i18n/messages");
    expect(allNavigationItems.filter((item) => item.href === "/dashboard/students")).toHaveLength(1);
    expect(messages.ar["nav.students"]).toBe("الطلاب");
    expect(messages.ar["nav.users"]).toBe("الموظفون والمستخدمون");
    expect(messages.en["nav.users"]).not.toBe(messages.en["nav.students"]);
  });
});
