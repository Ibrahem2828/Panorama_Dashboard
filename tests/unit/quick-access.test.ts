import { describe, expect, it } from "vitest";

import { allNavigationItems } from "@/config/navigation";
import { messages } from "@/i18n/messages";
import { INBOX_CATEGORIES, safeDashboardPath } from "@/features/notifications/inbox";
import { ATTENTION_ACTIONS, CREATE_ACTIONS, QUICK_ACTIONS } from "@/features/quick-access/quick-actions";

describe("notification deep links", () => {
  it("only follows relative dashboard paths", () => {
    expect(safeDashboardPath("/dashboard/enrollment?highlight=12")).toBe("/dashboard/enrollment?highlight=12");
    expect(safeDashboardPath("/dashboard/finance/purchases")).toBe("/dashboard/finance/purchases");
    expect(safeDashboardPath("/dashboard")).toBe("/dashboard");
  });

  it("falls back to the inbox for anything else", () => {
    for (const bad of ["https://evil.example/dashboard", "//evil.example", "/groups/4/chat", "/dashboard/../admin", "javascript:alert(1)", "", null, undefined, "/dashboard/x?a=<script>"]) {
      expect(safeDashboardPath(bad as string | null | undefined)).toBe("/dashboard/inbox");
    }
  });
});

describe("quick actions", () => {
  const known = new Set(allNavigationItems.map((item) => item.href));

  it("have unique keys and a translation in both languages", () => {
    expect(new Set(QUICK_ACTIONS.map((action) => action.key)).size).toBe(QUICK_ACTIONS.length);
    for (const action of QUICK_ACTIONS) {
      for (const locale of ["ar", "en"] as const) {
        expect(messages[locale][action.label], `${locale} ${action.label}`).toBeTruthy();
        expect(messages[locale][action.hint], `${locale} ${action.hint}`).toBeTruthy();
      }
    }
  });

  it("open real dashboard pages (creators may add a query string)", () => {
    for (const action of QUICK_ACTIONS) {
      expect(known.has(action.href.split("?")[0] as string), action.href).toBe(true);
    }
  });

  it("gate every queue and creator by the capability of its page", () => {
    const byHref = new Map(allNavigationItems.map((item) => [item.href, item.capability]));
    for (const action of [...ATTENTION_ACTIONS, ...CREATE_ACTIONS]) {
      expect(action.capability, action.key).toBe(byHref.get(action.href.split("?")[0] as string));
    }
  });

  it("only attention items carry a live counter", () => {
    expect(ATTENTION_ACTIONS.every((action) => action.count)).toBe(true);
    expect(CREATE_ACTIONS.some((action) => action.count)).toBe(false);
  });
});

describe("inbox categories", () => {
  it("each has a label in both languages", () => {
    for (const category of [...INBOX_CATEGORIES, "chat"]) {
      for (const locale of ["ar", "en"] as const) {
        expect(messages[locale][`inbox.category.${category}` as keyof (typeof messages)["ar"]], `${locale} ${category}`).toBeTruthy();
      }
    }
  });
});
