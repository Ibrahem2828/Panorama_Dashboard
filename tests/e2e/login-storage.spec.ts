import { expect, test } from "@playwright/test";

test("@e2e login page has no persisted credentials or tokens", async ({ page }) => {
  await page.goto("/ar/login");
  await expect(page).toHaveURL(/\/ar\/login$/);
  const storage = await page.evaluate(async () => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    databases: "databases" in indexedDB ? (await indexedDB.databases()).map((database) => database.name ?? "") : [],
    url: location.href,
  }));
  expect(storage.local.join(" ").toLowerCase()).not.toMatch(/access|refresh|jwt|token/);
  expect(storage.session.join(" ").toLowerCase()).not.toMatch(/access|refresh|jwt|token/);
  expect(storage.databases.join(" ").toLowerCase()).not.toMatch(/access|refresh|jwt|token/);
  expect(storage.url.toLowerCase()).not.toMatch(/[?&#](?:access|refresh|jwt|token)=/);
});
