import { describe, expect, it } from "vitest";

import { activeNavigationHref, allNavigationItems, capabilityForDashboardPath, navigationItemAllowed } from "@/config/navigation";
import { formSpecsFor } from "@/features/resources/resource-form-policy";
import {
  JOIN_REQUEST_ROUTE, failedResults, joinRequestListParams, joinRequestNotificationLink, joinRequestSummaryParams, joinRequestsHref, normalizeBulkResults,
} from "@/features/groups/join-requests-rules";
import { notificationTarget } from "@/features/notifications/inbox";
import { ATTENTION_ACTIONS } from "@/features/quick-access/quick-actions";
import { messages } from "@/i18n/messages";

describe("join request query params", () => {
  it("defaults to pending, newest first", () => {
    expect(joinRequestListParams({})).toEqual({ status: "pending", ordering: "-created_at" });
    expect(joinRequestListParams({ status: "rejected", group: "4" })).toEqual({ status: "rejected", group: "4", ordering: "-created_at" });
  });
  it("drops status and ordering for the summary", () => {
    expect(joinRequestSummaryParams({ status: "approved", group: "4", ordering: "x", kind: "subject" })).toEqual({ group: "4", kind: "subject" });
  });
  it("links to the screen, optionally for one group", () => {
    expect(joinRequestsHref()).toBe("/dashboard/groups/requests");
    expect(joinRequestsHref(12)).toBe("/dashboard/groups/requests?group=12");
  });
});

describe("bulk results", () => {
  it("keeps the order of the sent ids and counts a missing id as failed", () => {
    const results = normalizeBulkResults({ results: [{ id: 2, ok: false, error: "x" }, { id: 1, ok: true }] }, [1, 2, 3]);
    expect(results.map((item) => [item.id, item.ok])).toEqual([[1, true], [2, false], [3, false]]);
    expect(failedResults(results).map((item) => item.id)).toEqual([2, 3]);
  });
  it("accepts a bare array", () => {
    expect(normalizeBulkResults([{ id: 5, ok: true }], [5])).toEqual([{ id: 5, ok: true, error: undefined }]);
  });
});

describe("navigation, quick access and notification targets", () => {
  it("has exactly one entry for the screen, guarded by the group management capability", () => {
    const entries = allNavigationItems.filter((item) => item.href === JOIN_REQUEST_ROUTE);
    expect(entries).toHaveLength(1);
    expect(navigationItemAllowed(entries[0], ["groups.manage"])).toBe(true);
    expect(navigationItemAllowed(entries[0], ["files.manage"])).toBe(false);
    expect(capabilityForDashboardPath("/ar/dashboard/groups/requests")).toBe("groups.manage");
    expect(messages.ar[entries[0].label]).toBe("طلبات الانضمام للمجموعات");
  });
  it("highlights only the most specific sidebar entry", () => {
    expect(activeNavigationHref("/ar/dashboard/groups/requests")).toBe("/dashboard/groups/requests");
    expect(activeNavigationHref("/en/dashboard/groups")).toBe("/dashboard/groups");
    expect(activeNavigationHref("/ar/dashboard/groups/")).toBe("/dashboard/groups");
  });
  it("points the join_requests_pending tile at the new screen", () => {
    expect(ATTENTION_ACTIONS.find((action) => action.count === "join_requests_pending")?.href).toBe(JOIN_REQUEST_ROUTE);
  });
  it("moves the legacy join-request notification target to the new screen, filtered to the group", () => {
    expect(joinRequestNotificationLink("/dashboard/groups?highlight=9", "join_request")).toBe("/dashboard/groups/requests?group=9");
    expect(joinRequestNotificationLink("/dashboard/groups", "join_request")).toBe(JOIN_REQUEST_ROUTE);
    expect(joinRequestNotificationLink("/dashboard/groups?highlight=9", "groups")).toBe("/dashboard/groups?highlight=9");
    expect(notificationTarget({ deep_link: "/dashboard/groups?highlight=9", category: "join_request" })).toBe("/dashboard/groups/requests?group=9");
    expect(notificationTarget({ deep_link: "/dashboard/groups/requests?highlight=77", category: "join_request" })).toBe("/dashboard/groups/requests?highlight=77");
    expect(notificationTarget({ deep_link: "https://evil.example", category: "join_request" })).toBe("/dashboard/inbox");
  });
});

describe("subject form", () => {
  it.each(["create", "edit"] as const)("lets the admin edit the code and the description (textarea) when %s", (mode) => {
    const specs = formSpecsFor("subjects", mode);
    expect(specs.find((item) => item.name === "code")).toMatchObject({ kind: "text", maxLength: 32 });
    expect(specs.find((item) => item.name === "description")).toMatchObject({ kind: "textarea" });
  });
});
