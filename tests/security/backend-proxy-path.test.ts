import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/backend/[...path]/route";

function request(path: string[]) {
  return GET(
    new NextRequest("https://dashboard.example.test/api/backend/ignored", { method: "GET" }),
    { params: Promise.resolve({ path }) },
  );
}

describe("contract-bound backend BFF path validation", () => {
  it("rejects encoded traversal before session handling", async () => {
    expect((await request(["api", "v1", "%252e%252e"])).status).toBe(400);
  });

  it("rejects an absolute-url shaped segment before session handling", async () => {
    expect((await request(["api", "v1", "https:%2F%2Fevil.example"])).status).toBe(400);
  });

  it("rejects normalized paths that are absent from the OpenAPI contract", async () => {
    const response = await request(["api", "v1", "not-a-documented-operation"]);
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("BACKEND_OPERATION_NOT_ALLOWED");
  });
});
