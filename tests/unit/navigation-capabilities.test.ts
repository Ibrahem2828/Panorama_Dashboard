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
