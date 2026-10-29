import { describe, expect, it } from "vitest";

import { isTruncated, parseProfileTab, parseUserId, profileTabHref, refName, tabCount, type StudentDetail } from "@/features/users/user-profile-rules";

const detail = (over: Partial<StudentDetail> = {}): StudentDetail => ({
  user: { id: 1, full_name: "Ali", email: null, phone_number: null, job_title: null, is_active: true, last_login: null, created_at: "2026-01-01T00:00:00Z" },
  profile: null,
  groups: [{ membership_id: 1, group_id: 1, group_name: "g", role: "member", status: "approved", joined_at: null }],
  enrollments: [], files: [], print_orders: [], support_tickets: [], verification_history: [], ...over,
});

describe("profile tabs", () => {
  it("falls back to the overview for unknown tabs", () => {
    expect(parseProfileTab("groups")).toBe("groups");
    expect(parseProfileTab("nope")).toBe("overview");
    expect(parseProfileTab(null)).toBe("overview");
  });
  it("keeps the overview URL clean", () => {
    expect(profileTabHref("/ar/dashboard/users/4", "overview")).toBe("/ar/dashboard/users/4");
    expect(profileTabHref("/ar/dashboard/users/4", "orders")).toBe("/ar/dashboard/users/4?tab=orders");
  });
});

describe("parseUserId", () => {
  it("accepts plain integers only", () => {
    expect(parseUserId("42")).toBe(42);
    expect(parseUserId(["7"])).toBe(7);
    expect(parseUserId("12abc")).toBeNull();
    expect(parseUserId("../x")).toBeNull();
    expect(parseUserId(undefined)).toBeNull();
  });
});

describe("refName / counts", () => {
  it("reads strings and name objects", () => {
    expect(refName("x")).toBe("x");
    expect(refName({ id: 1, name: "كلية" })).toBe("كلية");
    expect(refName(null)).toBe("");
  });
  it("uses the server total when the list is capped", () => {
    const capped = detail({ counts: { groups: 80 } });
    expect(tabCount(capped, "groups")).toBe(80);
    expect(isTruncated(capped, "groups")).toBe(true);
    expect(tabCount(detail(), "groups")).toBe(1);
    expect(isTruncated(detail(), "groups")).toBe(false);
  });
});
