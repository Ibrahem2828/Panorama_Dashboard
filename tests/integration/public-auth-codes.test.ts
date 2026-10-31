import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ backendFetch: vi.fn() }));
vi.mock("@/lib/api/backend", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api/backend")>()), backendFetch: mocks.backendFetch }));

import { POST } from "@/app/api/auth/public/[action]/route";

const TOKEN = "t".repeat(32);

function post(action: string, body: unknown) {
  return POST(
    new NextRequest(`https://dashboard.example.test/api/auth/public/${action}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { origin: "https://dashboard.example.test", "sec-fetch-site": "same-origin", "content-type": "application/json" },
    }),
    { params: Promise.resolve({ action }) },
  );
}

function backend(status: number, data: unknown) {
  return { ok: status < 400, status, data, response: new Response(null, { status }) };
}

describe("public auth BFF: invitation lifecycle codes", () => {
  beforeEach(() => mocks.backendFetch.mockReset());

  it("forwards the stable backend code and Arabic message of a refused accept", async () => {
    mocks.backendFetch.mockResolvedValueOnce(backend(400, { success: false, code: "INVITATION_ACCEPTED_ALREADY", message: "تم تعيين كلمة المرور بالفعل." }));
    const response = await post("invitation-accept", { token: TOKEN, password: "Correct-horse-42", password_confirm: "Correct-horse-42" });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVITATION_ACCEPTED_ALREADY", message: "تم تعيين كلمة المرور بالفعل." });
  });

  it("ignores a code that is not a plain upper-case identifier", async () => {
    mocks.backendFetch.mockResolvedValueOnce(backend(400, { code: "<script>", message: "x" }));
    const response = await post("invitation-accept", { token: TOKEN, password: "a", password_confirm: "a" });
    expect((await response.json()).code).toBe("UPSTREAM_REJECTED");
  });

  it("returns the lookup state of an invitation", async () => {
    mocks.backendFetch.mockResolvedValueOnce(backend(200, { success: true, data: { state: "accepted", email_masked: "s***@example.com" } }));
    const response = await post("invitation-info", { token: TOKEN });
    expect((await response.json()).data).toEqual({ state: "accepted", email_masked: "s***@example.com" });
  });
});
