import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { middleware } from "../../middleware";

describe("dashboard page middleware", () => {
  for (const locale of ["ar", "en"]) {
    it(`does not redirect a direct /${locale}/dashboard load when /api cookies are absent from the page request`, () => {
      const request = new NextRequest(`https://dashboard.example.test/${locale}/dashboard`);
      const response = middleware(request);
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    });
  }
});
