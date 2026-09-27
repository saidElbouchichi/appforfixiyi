import { expect, test } from "@playwright/test";

/** Phase 12 evidence: a frame DURING the tiles' entry, first visit versus cached return. */
test("home tiles, mid-entry", async ({ page }) => {
  const E = "../../docs/design/evidence/phase12";
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await expect(page.getByTestId("domain-grid")).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = 60; } });
  await page.screenshot({ path: `${E}/premiere-visite-60ms.png` });
  await page.goto("/services?q=panne");
  await expect(page.locator("h1")).toHaveCount(1);
  await page.locator("header a[href='/']").first().click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByTestId("domain-grid")).toBeVisible();
  await page.evaluate(() => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = 60; } });
  await page.screenshot({ path: `${E}/retour-cache-60ms.png` });
});
