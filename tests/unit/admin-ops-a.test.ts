/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";

import { accountNavigation, academicSubNavigation, allNavigationItems, capabilityForDashboardPath, navigationGroups } from "@/config/navigation";
import { CONFIRM_WORD, confirmationMatches, groupsNeedingWhatsappWork, previewTotals, termLabelProblem, whatsappCopyText } from "@/features/academic-term/rules";
import { OPTIONAL_INBOX_CATEGORIES, INBOX_CATEGORIES, visibleInboxCategories, type InboxNotification } from "@/features/notifications/inbox";
import { LIVE_POLL_HIDDEN_MS, LIVE_POLL_VISIBLE_MS, livePollInterval, newArrivals, readSoundEnabled, withUnreadBadge, writeSoundEnabled } from "@/features/notifications/live";
import { profileChanges, validateProfile } from "@/features/profile/rules";
import { ATTENTION_ACTIONS, CREATE_ACTIONS, TERM_ACTION, termNeedsAttention, visibleAttention } from "@/features/quick-access/quick-actions";
import { formSpecsFor } from "@/features/resources/resource-form-policy";
import { RESOURCE_COLUMNS } from "@/features/resources/columns";
import { messages } from "@/i18n/messages";

const note = (id: number, is_read = false): InboxNotification => ({ id, title: `n${id}`, body: "", category: "", type: "x", deep_link: "/dashboard", is_read, created_at: "2026-10-29T00:00:00Z" });

describe("tab title badge", () => {
  it("adds, replaces and removes the unread prefix idempotently", () => {
    expect(withUnreadBadge("Panorama", 3)).toBe("(3) Panorama");
    expect(withUnreadBadge("(3) Panorama", 5)).toBe("(5) Panorama");
    expect(withUnreadBadge("(5) Panorama", 5)).toBe("(5) Panorama");
    expect(withUnreadBadge("(5) Panorama", 0)).toBe("Panorama");
    expect(withUnreadBadge("Panorama", 250)).toBe("(99+) Panorama");
    expect(withUnreadBadge("(99+) Panorama", 0)).toBe("Panorama");
  });
});

describe("new notification detection", () => {
  it("only sets a baseline on the first load", () => {
    const first = newArrivals([note(5), note(4)], null);
    expect(first.fresh).toEqual([]);
    expect(first.highestId).toBe(5);
  });
  it("returns unread items above the baseline, oldest first", () => {
    const next = newArrivals([note(8), note(7, true), note(6), note(5)], 5);
    expect(next.fresh.map((item) => item.id)).toEqual([6, 8]);
    expect(next.highestId).toBe(8);
  });
  it("never repeats an item and copes with an empty list", () => {
    expect(newArrivals([note(8)], 8).fresh).toEqual([]);
    expect(newArrivals([], 8)).toEqual({ fresh: [], highestId: 8 });
    expect(newArrivals([], null)).toEqual({ fresh: [], highestId: null });
  });
});

describe("polling interval and sound preference", () => {
  afterEach(() => { window.localStorage.clear(); });
  it("polls fast when visible and slowly when hidden", () => {
    expect(LIVE_POLL_VISIBLE_MS).toBeLessThan(LIVE_POLL_HIDDEN_MS);
    expect(livePollInterval()).toBe(LIVE_POLL_VISIBLE_MS);
  });
  it("remembers a muted choice", () => {
    expect(readSoundEnabled()).toBe(true);
    writeSoundEnabled(false);
    expect(readSoundEnabled()).toBe(false);
    writeSoundEnabled(true);
    expect(readSoundEnabled()).toBe(true);
  });
});

describe("inbox categories", () => {
  it("always offers chat and keeps general last", () => {
    expect(INBOX_CATEGORIES).toContain("chat");
    const tabs = visibleInboxCategories({});
    expect(tabs[tabs.length - 1]).toBe("general");
    expect(tabs).toContain("chat");
  });
  it("shows the registration and join-request tabs only once the backend reports them", () => {
    expect(visibleInboxCategories({ enrollment: 1 })).not.toContain("join_request");
    const tabs = visibleInboxCategories({ join_request: 2, student_registration: 0 });
    expect(tabs).toContain("join_request");
    expect(tabs).toContain("student_registration");
  });
  it("has labels in both languages", () => {
    for (const key of [...INBOX_CATEGORIES, ...OPTIONAL_INBOX_CATEGORIES]) {
      for (const locale of ["ar", "en"] as const) expect(messages[locale][`inbox.category.${key}` as keyof (typeof messages)["ar"]], `${locale} ${key}`).toBeTruthy();
    }
  });
});

describe("quick access tiles", () => {
  it("shows the new tiles only when the backend sends their counter", () => {
    const keys = (counts: Parameters<typeof visibleAttention>[1]) => visibleAttention(ATTENTION_ACTIONS, counts).map((action) => action.key);
    expect(keys({ enrollment_pending: 1 })).not.toContain("joinRequests");
    expect(keys({ enrollment_pending: 1 })).not.toContain("registrations");
    expect(keys({ join_requests_pending: 0 })).toContain("joinRequests");
    expect(keys({ registrations_new: 4 })).toContain("registrations");
    expect(keys(undefined)).not.toContain("joinRequests");
  });
  it("has no inbox tile (the inbox lives in the bell and the sidebar)", () => {
    expect([...ATTENTION_ACTIONS, ...CREATE_ACTIONS].some((action) => action.href === "/dashboard/inbox")).toBe(false);
  });
  it("nudges about the term only after it has run for a long time", () => {
    const now = Date.parse("2026-10-29T00:00:00Z");
    expect(termNeedsAttention("2026-09-01T00:00:00Z", now)).toBe(false);
    expect(termNeedsAttention("2026-05-01T00:00:00Z", now)).toBe(true);
    expect(termNeedsAttention(null, now)).toBe(false);
    expect(termNeedsAttention("not a date", now)).toBe(false);
    expect(capabilityForDashboardPath(TERM_ACTION.href)).toBe(TERM_ACTION.capability);
  });
});

describe("navigation de-duplication", () => {
  const sidebarHrefs = navigationGroups.flatMap((group) => group.items.map((item) => item.href));
  it("has no repeated destination in the sidebar", () => {
    expect(new Set(sidebarHrefs).size).toBe(sidebarHrefs.length);
  });
  it("keeps settings and the profile out of the sidebar (they live in the user menu)", () => {
    expect(sidebarHrefs).not.toContain("/dashboard/settings");
    expect(sidebarHrefs).not.toContain("/dashboard/profile");
    expect(accountNavigation.map((item) => item.href)).toEqual(["/dashboard/profile", "/dashboard/settings"]);
  });
  it("still gates the personal pages and the term page", () => {
    expect(capabilityForDashboardPath("/ar/dashboard/profile")).toBe("dashboard.access");
    expect(capabilityForDashboardPath("/ar/dashboard/settings")).toBe("dashboard.access");
    expect(capabilityForDashboardPath("/ar/dashboard/academic/term")).toBe("academic.manage");
    expect(academicSubNavigation.map((item) => item.key)).toContain("term");
  });
  it("gives the three notification pages distinct labels and icons", () => {
    const pick = (key: string) => allNavigationItems.find((item) => item.key === key)!;
    const items = [pick("inbox"), pick("notifications"), pick("notificationHealth")];
    for (const locale of ["ar", "en"] as const) expect(new Set(items.map((item) => messages[locale][item.label])).size).toBe(3);
    expect(new Set(items.map((item) => item.icon)).size).toBe(3);
  });
});

describe("end-of-term rules", () => {
  it("accepts the word or the number of students, in either digit system", () => {
    expect(confirmationMatches(CONFIRM_WORD, 120)).toBe(true);
    expect(confirmationMatches("  إنهاء ", 120)).toBe(true);
    expect(confirmationMatches("120", 120)).toBe(true);
    expect(confirmationMatches("١٢٠", 120)).toBe(true);
    expect(confirmationMatches("121", 120)).toBe(false);
    expect(confirmationMatches("", 0)).toBe(false);
    expect(confirmationMatches("نعم", 120)).toBe(false);
  });
  it("totals the preview and picks the groups that need manual WhatsApp work", () => {
    const groups = [
      { group_id: 1, name: "A", subject: "x", whatsapp_active: true, members_to_remove: 5 },
      { group_id: 2, name: "B", subject: "y", whatsapp_active: false, members_to_remove: 3 },
      { group_id: 3, name: "C", subject: "z", whatsapp_active: true, members_to_remove: 0 },
    ];
    expect(previewTotals(groups)).toEqual({ groups: 3, whatsappGroups: 2, members: 8 });
    expect(groupsNeedingWhatsappWork(groups).map((group) => group.group_id)).toEqual([1]);
  });
  it("formats a copyable removal list", () => {
    expect(whatsappCopyText({ group_id: 1, name: "G", members: [{ full_name: "علي", phone_number: "+963911" }] })).toBe("G\nعلي\t+963911");
  });
  it("validates the label", () => {
    expect(termLabelProblem("  ")).toBe("required");
    expect(termLabelProblem("x".repeat(121))).toBe("tooLong");
    expect(termLabelProblem("الفصل الأول")).toBeNull();
  });
});

describe("profile rules", () => {
  it("validates the name and job title", () => {
    expect(validateProfile({ full_name: " ", job_title: "" }).full_name).toBe("required");
    expect(validateProfile({ full_name: "x".repeat(151), job_title: "" }).full_name).toBe("tooLong");
    expect(validateProfile({ full_name: "علي", job_title: "x".repeat(121) }).job_title).toBe("tooLong");
    expect(validateProfile({ full_name: "علي", job_title: "" })).toEqual({});
  });
  it("sends only the changed, trimmed fields", () => {
    const saved = { full_name: "علي", job_title: "" };
    expect(profileChanges(saved, { full_name: "علي ", job_title: "" })).toEqual({});
    expect(profileChanges(saved, { full_name: "علي", job_title: " مشرف " })).toEqual({ job_title: "مشرف" });
    expect(profileChanges(saved, { full_name: "سعيد", job_title: "" })).toEqual({ full_name: "سعيد" });
  });
});

describe("admin users", () => {
  it("edits and lists the job title even though the generated contract does not carry it yet", () => {
    const names = formSpecsFor("users", "edit").map((spec) => spec.name);
    expect(names).toEqual(["full_name", "job_title", "role"]);
    const job = formSpecsFor("users", "edit").find((spec) => spec.name === "job_title")!;
    expect(job.maxLength).toBe(120);
    expect(job.required).toBe(false);
    expect(RESOURCE_COLUMNS.users!.map((column) => column.key)).toContain("job_title");
  });
});
