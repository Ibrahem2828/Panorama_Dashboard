import { describe, expect, it } from "vitest";

import { canExecuteDeletion, deletionPath, emailMatches, isPendingDeletion, userBrief } from "@/features/governance/deletion-rules";
import { deviceStats } from "@/features/product/device-rules";

describe("deletion rules", () => {
  it("only admin-level roles may execute early", () => {
    expect(canExecuteDeletion("admin")).toBe(true);
    expect(canExecuteDeletion("it_support")).toBe(true);
    for (const role of ["support_staff", "print_staff", "content_manager", "student", undefined]) expect(canExecuteDeletion(role)).toBe(false);
  });

  it("acts only on pending requests", () => {
    expect(isPendingDeletion({ status: "requested" })).toBe(true);
    expect(isPendingDeletion({ status: "cancelled" })).toBe(false);
    expect(isPendingDeletion({ status: "completed" })).toBe(false);
  });

  it("matches the confirmation e-mail ignoring case and spaces, and never an empty one", () => {
    expect(emailMatches(" Ali@Example.com ", "ali@example.com")).toBe(true);
    expect(emailMatches("other@example.com", "ali@example.com")).toBe(false);
    expect(emailMatches("", "")).toBe(false);
    expect(emailMatches("x", undefined)).toBe(false);
  });

  it("reads a user brief and builds the detail path", () => {
    expect(userBrief({ id: 1, full_name: "Ali", email: "a@b.c", role: "student" })).toMatchObject({ name: "Ali", email: "a@b.c" });
    expect(userBrief(null)).toBeNull();
    expect(deletionPath(7)).toBe("/api/v1/dashboard/account-deletions/7/");
  });
});

describe("device stats", () => {
  it("normalises the stats payload and tolerates missing parts", () => {
    expect(deviceStats({ total: 3, active: 2, revoked: 1, push_enabled: 2, by_platform: [{ platform: "ios", count: 1 }, { nope: 1 }], top_versions: [{ app_version: "1.0", count: 2 }] })).toEqual({
      total: 3, active: 2, revoked: 1, pushEnabled: 2, byPlatform: [{ label: "ios", count: 1 }], topVersions: [{ label: "1.0", count: 2 }],
    });
    expect(deviceStats(null)).toEqual({ total: 0, active: 0, revoked: 0, pushEnabled: 0, byPlatform: [], topVersions: [] });
  });
});
