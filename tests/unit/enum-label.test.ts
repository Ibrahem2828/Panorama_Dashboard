import { describe, expect, it } from "vitest";

import { messages } from "@/i18n/messages";
import { resolveEnumLabel } from "@/i18n/enum-label";

describe("resolveEnumLabel", () => {
  it("maps known status, enum and role values to Arabic", () => {
    expect(resolveEnumLabel("ar", "under_review")).toBe(messages.ar["status.under_review"]);
    expect(resolveEnumLabel("ar", "verified_students")).toBe(messages.ar["enum.verified_students"]);
    expect(resolveEnumLabel("ar", "admin")).toBe(messages.ar["roles.admin"]);
    expect(resolveEnumLabel("ar", "READY")).toBe(messages.ar["status.ready"]);
  });

  it("never shows an unknown English value in Arabic", () => {
    expect(resolveEnumLabel("ar", "some_new_state")).toBe(messages.ar["common.unknownValue"]);
  });

  it("keeps non-Latin and empty values and humanizes in English", () => {
    expect(resolveEnumLabel("ar", "42")).toBe("42");
    expect(resolveEnumLabel("ar", null)).toBe("—");
    expect(resolveEnumLabel("en", "some_new_state")).toBe("Some New State");
  });
});
