import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isWhatsappChannelPath, scrubWhatsappChannelBody } from "@/lib/security/redact";

const mocks = vi.hoisted(() => ({ readTokens: vi.fn(), refreshTokensResult: vi.fn() }));
vi.mock("@/lib/auth/server-session", () => ({ readTokens: mocks.readTokens, refreshTokensResult: mocks.refreshTokensResult }));

import { PUT } from "@/app/api/backend/[...path]/route";

const fetchMock = vi.fn();
const CSRF = "c".repeat(32);
const SECRET = "https://chat.whatsapp.com/SECRETINVITE";

beforeEach(() => {
  fetchMock.mockReset();
  mocks.readTokens.mockReturnValue({ access: "acc", refresh: undefined });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("WhatsApp channel responses never carry the invite link", () => {
  it("strips url from the PUT whatsapp-channel response", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, data: { url: SECRET, is_active: true, label: "Group" } }), { status: 200, headers: { "content-type": "application/json", "content-length": "999" } }));
    const request = new NextRequest("https://dashboard.example.test/api/backend/api/v1/dashboard/groups/4/whatsapp-channel/", {
      method: "PUT",
      body: JSON.stringify({ url: SECRET, is_active: true }),
      headers: { cookie: `panorama_access=acc; panorama_csrf=${CSRF}`, "x-panorama-csrf": CSRF, origin: "https://dashboard.example.test", "sec-fetch-site": "same-origin", "content-type": "application/json" },
    });
    const response = await PUT(request, { params: Promise.resolve({ path: ["api", "v1", "dashboard", "groups", "4", "whatsapp-channel"] }) });
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).not.toContain("SECRETINVITE");
    expect(JSON.parse(text)).toEqual({ success: true, data: { is_active: true, label: "Group" } });
  });

  it("scrubs nested urls and turns non-JSON into an empty object", () => {
    expect(JSON.parse(scrubWhatsappChannelBody(JSON.stringify({ errors: { url: [SECRET] }, items: [{ url: SECRET, ok: 1 }] })))).toEqual({ errors: {}, items: [{ ok: 1 }] });
    expect(scrubWhatsappChannelBody("<html>" + SECRET)).toBe("{}");
    expect(isWhatsappChannelPath("/api/v1/dashboard/groups/4/whatsapp-channel/")).toBe(true);
    expect(isWhatsappChannelPath("/api/v1/dashboard/groups/4/")).toBe(false);
  });
});
