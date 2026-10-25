import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/auth/public/[action]/route";
import { titleFromFileName } from "@/features/files/bulk-upload";

describe("bulk upload titles", () => {
  it("turns file names into readable titles", () => {
    expect(titleFromFileName("Dental_Anatomy-notes.pdf")).toBe("Dental Anatomy notes");
    expect(titleFromFileName("  lecture   3 .PNG")).toBe("lecture 3");
    expect(titleFromFileName("noextension")).toBe("noextension");
    expect(titleFromFileName("x".repeat(400) + ".pdf")).toHaveLength(255);
  });
});

describe("public auth BFF route", () => {
  it("only serves its four allowlisted actions", async () => {
    const request = new NextRequest("https://dashboard.example.test/api/auth/public/delete-everything", { method: "POST", body: "{}" });
    const response = await POST(request, { params: Promise.resolve({ action: "delete-everything" }) });
    expect(response.status).toBe(404);
  });

  it("refuses a cross-origin submission before touching the backend", async () => {
    const request = new NextRequest("https://dashboard.example.test/api/auth/public/invitation-accept", {
      method: "POST",
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      body: JSON.stringify({ token: "a".repeat(32), password: "x", password_confirm: "x" }),
    });
    const response = await POST(request, { params: Promise.resolve({ action: "invitation-accept" }) });
    expect(response.status).toBe(403);
  });
});
