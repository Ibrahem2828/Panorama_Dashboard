import { describe, expect, it } from "vitest";

import { capabilityForDashboardPath } from "@/config/navigation";
import { currentVersion, safeHttpUrl } from "@/features/governance/policy-rules";
import { derivedIdempotencyKey, editableWindow, enabledWindows, maintenanceState } from "@/features/product/maintenance-rules";
import { validateReleasePolicy } from "@/features/product/release-rules";
import { ASSIGNEE_ROLES, toAssigneeOptions } from "@/features/staff/use-assignees";
import { actorOutranks, assignableRoles, canActivateUser, canChangeRole, canDeactivateUser, canEditUser } from "@/features/users/user-rules";
import { ROLE_CAPABILITY_FALLBACK, roleBaselineHas } from "@/lib/auth/capabilities";
import { apiErrorText } from "@/lib/api/error-message";
import { AppApiError } from "@/lib/api/errors";
import { isoToLocalInput, localInputToIso } from "@/lib/datetime";
import { messages } from "@/i18n/messages";

describe("user rules (mirror of the backend rank rules)", () => {
  const itSupport = { id: 1, role: "it_support" };
  const admin = { id: 2, role: "admin" };

  it("lets IT Support manage everyone and everyone else only strictly lower ranks", () => {
    expect(actorOutranks("it_support", "it_support")).toBe(true);
    expect(actorOutranks("admin", "admin")).toBe(false);
    expect(actorOutranks("admin", "it_support")).toBe(false);
    expect(actorOutranks("admin", "support_staff")).toBe(true);
    expect(actorOutranks("print_staff", "support_staff")).toBe(false);
  });

  it("offers an admin only roles below admin, and IT Support every role", () => {
    expect(assignableRoles("it_support")).toHaveLength(7);
    expect(assignableRoles("admin")).toEqual(["print_staff", "support_staff", "content_manager", "student", "normal_user"]);
    expect(assignableRoles("support_staff")).toEqual([]);
  });

  it("gates edit, role change, activate and deactivate like the backend", () => {
    const content = { id: 9, role: "content_manager", is_active: true };
    const peerAdmin = { id: 7, role: "admin", is_active: true };
    expect(canEditUser(admin, content)).toBe(true);
    expect(canEditUser(admin, peerAdmin)).toBe(false);
    expect(canEditUser(admin, { id: admin.id, role: "admin" })).toBe(false);
    expect(canEditUser(itSupport, { id: itSupport.id, role: "it_support" })).toBe(true);
    expect(canChangeRole(itSupport, { id: itSupport.id, role: "it_support" })).toBe(false);
    expect(canChangeRole(itSupport, peerAdmin)).toBe(true);
    expect(canDeactivateUser(admin, content)).toBe(true);
    expect(canDeactivateUser(admin, { ...content, is_active: false })).toBe(false);
    expect(canDeactivateUser(itSupport, { id: itSupport.id, role: "it_support", is_active: true })).toBe(false);
    expect(canActivateUser(admin, { ...content, is_active: false })).toBe(true);
    expect(canActivateUser(admin, { ...peerAdmin, is_active: false })).toBe(false);
  });
});

describe("RBAC baseline", () => {
  it("is not the same for every role", () => {
    expect(roleBaselineHas("it_support", "system.manage")).toBe(true);
    expect(roleBaselineHas("admin", "system.manage")).toBe(false);
    expect(roleBaselineHas("print_staff", "printing.manage")).toBe(true);
    expect(roleBaselineHas("print_staff", "users.manage")).toBe(false);
    expect(roleBaselineHas("content_manager", "announcements.manage")).toBe(true);
    expect(roleBaselineHas("support_staff", "feedback.manage")).toBe(true);
    const rows = Object.keys(ROLE_CAPABILITY_FALLBACK).map((role) => roleBaselineHas(role as "admin", "product.manage"));
    expect(new Set(rows).size).toBe(2);
  });
});

describe("navigation gating of notifications", () => {
  it("requires the capability the campaign endpoint requires (product.manage), not announcements.manage", () => {
    expect(capabilityForDashboardPath("/ar/dashboard/notifications")).toBe("product.manage");
  });
});

describe("assignees", () => {
  const records = [
    { id: 3, full_name: "Zed", role: "print_staff", is_active: true },
    { id: 1, full_name: "Amal", role: "admin", is_active: true },
    { id: 2, full_name: "Gone", role: "print_staff", is_active: false },
    { id: 4, full_name: "Student", role: "student", is_active: true },
    { id: 1, full_name: "Amal", role: "admin", is_active: true },
  ];

  it("keeps active accounts with an allowed role, de-duplicated and sorted by name", () => {
    expect(toAssigneeOptions(records, ASSIGNEE_ROLES.printing)).toEqual([{ id: 1, name: "Amal" }, { id: 3, name: "Zed" }]);
    expect(toAssigneeOptions(records, ASSIGNEE_ROLES.support)).toEqual([{ id: 1, name: "Amal" }]);
  });

  it("matches the roles the backend accepts per workflow", () => {
    expect([...ASSIGNEE_ROLES.printing].sort()).toEqual(["admin", "it_support", "print_staff"]);
    expect([...ASSIGNEE_ROLES.support].sort()).toEqual(["admin", "it_support", "support_staff"]);
    expect([...ASSIGNEE_ROLES.feedback].sort()).toEqual(["admin", "it_support", "support_staff"]);
  });

  it("has an explanation for staff who cannot list accounts", () => {
    expect(messages.ar["assignees.limited"]).toBeTruthy();
    expect(messages.en["assignees.limited"]).toContain("users.manage");
  });
});

describe("policy versions", () => {
  it("picks the newest published among the active versions", () => {
    const versions = [
      { version: "1", is_active: true, published_at: "2026-01-01T00:00:00Z" },
      { version: "3", is_active: false, published_at: "2026-09-01T00:00:00Z" },
      { version: "2", is_active: true, published_at: "2026-05-01T00:00:00Z" },
    ];
    expect(currentVersion(versions)?.version).toBe("2");
    expect(currentVersion([{ version: "x", is_active: false }])).toBeNull();
  });

  it("only links http(s) URLs", () => {
    expect(safeHttpUrl("https://example.com/terms")).toBe("https://example.com/terms");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });
});

describe("maintenance windows", () => {
  const rows = [
    { id: 1, enabled: false, updated_at: "2026-01-01T00:00:00Z" },
    { id: 2, enabled: true, is_currently_active: true, updated_at: "2026-02-01T00:00:00Z" },
    { id: 3, enabled: true, is_currently_active: false, updated_at: "2026-03-01T00:00:00Z" },
  ];

  it("derives the state and which rows a disable has to switch off", () => {
    expect(maintenanceState([rows[0]])).toBe("off");
    expect(maintenanceState([rows[2]])).toBe("scheduled");
    expect(maintenanceState(rows)).toBe("on");
    expect(enabledWindows(rows).map((row) => row.id)).toEqual([2, 3]);
    expect(editableWindow(rows)?.id).toBe(3);
    expect(editableWindow([rows[0]])).toBeNull();
  });

  it("derives per-record idempotency keys that satisfy the BFF key format", () => {
    const key = derivedIdempotencyKey("3f1c9e2a-1111-2222-3333-444455556666", 12);
    expect(key).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,255}$/u);
    expect(derivedIdempotencyKey("a", 1)).not.toBe(derivedIdempotencyKey("a", 2));
  });
});

describe("release policy guard", () => {
  const rows = [{ id: 1, platform: "android", is_active: true }, { id: 2, platform: "ios", is_active: false }];

  it("blocks a second active policy for a platform but allows editing the active one", () => {
    expect(validateReleasePolicy({ platform: "android", is_active: true, update_mode: "none" }, null, rows)).toEqual({ field: "is_active", message: "validation.activeRelease:android" });
    expect(validateReleasePolicy({ latest_version: "2.0.0" }, rows[0], rows)).toBeNull();
    expect(validateReleasePolicy({ platform: "ios", is_active: true }, null, rows)).toBeNull();
    expect(validateReleasePolicy({ platform: "android", is_active: false }, null, rows)).toBeNull();
  });

  it("requires a minimum build for a required update", () => {
    expect(validateReleasePolicy({ platform: "ios", is_active: true, update_mode: "required", minimum_supported_build: 0 }, null, rows)).toEqual({ field: "minimum_supported_build", message: "validation.requiredBuild" });
    expect(validateReleasePolicy({ platform: "ios", is_active: true, update_mode: "required", minimum_supported_build: 14 }, null, rows)).toBeNull();
  });
});

describe("datetime conversion", () => {
  it("round-trips a local datetime-local value through an ISO instant", () => {
    const iso = localInputToIso("2030-05-01T09:30");
    expect(iso).toBe(new Date("2030-05-01T09:30").toISOString());
    expect(isoToLocalInput(iso)).toBe("2030-05-01T09:30");
  });

  it("returns empty/null for blank or invalid input", () => {
    expect(localInputToIso("")).toBeNull();
    expect(localInputToIso("not a date")).toBeNull();
    expect(localInputToIso(null)).toBeNull();
    expect(isoToLocalInput(null)).toBe("");
    expect(isoToLocalInput("garbage")).toBe("");
  });
});

describe("403 / 409 messages", () => {
  const t = (key: keyof typeof messages.en) => messages.en[key];

  it("adds the backend reason to the localized headline", () => {
    expect(apiErrorText(new AppApiError({ status: 403, message: "You cannot manage an account with an equal or higher role." }), t)).toBe(`${messages.en["errors.403"]} You cannot manage an account with an equal or higher role.`);
    expect(apiErrorText(new AppApiError({ status: 403, message: "Permission denied" }), t)).toBe(messages.en["errors.403"]);
    expect(apiErrorText(new AppApiError({ status: 409, code: "CONFLICT", message: "The system must keep one active IT Support account." }), t)).toContain("IT Support");
  });
});
