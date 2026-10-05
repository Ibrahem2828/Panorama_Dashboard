import { describe, expect, it } from "vitest";

import { sessionFromUser } from "@/lib/auth/server-session";

describe("session capability source", () => {
  const user = { id: 1, full_name: "P0 Test", email: "p0@example.test", role: "admin", is_active: true };

  it("fails closed when backend capabilities are absent", () => {
    expect(sessionFromUser(user)).toBeNull();
  });

  it("uses backend effective capabilities only", () => {
    const session = sessionFromUser({ ...user, effective_capabilities: ["dashboard.access"] });
    expect(session?.effectiveCapabilities).toEqual(["dashboard.access"]);
    expect(session?.capabilitySource).toBe("backend");
  });

  it("does not reject a backend role solely because the frontend has not enumerated it", () => {
    expect(sessionFromUser({ ...user, role: "new_dashboard_role", effective_capabilities: ["dashboard.access"] })?.role).toBe("new_dashboard_role");
  });
});
