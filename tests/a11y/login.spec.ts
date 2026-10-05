import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("@a11y login page has no serious axe violations", async ({ page }) => {
  await page.goto("/ar/login");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});
