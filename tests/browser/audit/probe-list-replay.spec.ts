import { writeFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

/**
 * Phase 12 audit: does a staggered list replay its entry when the page is
 * revisited with its data already cached (client-side navigation)?
 * Output: evidence/phase12/list-replay-${process.env.AUDIT_LABEL ?? "avant"}.json.
 */
test("home tiles: first visit versus a cached return", async ({ page }) => {
  const count = (): Promise<number> =>
    page.evaluate(() => document.getAnimations().filter((a) => ((a.effect as KeyframeEffect).target as Element | null)?.closest("[data-testid=domain-grid]")).length);
  await page.goto("/");
  await expect(page.getByTestId("domain-grid")).toBeVisible({ timeout: 20_000 });
  const firstVisit = await count();
  const skeletonSeenFirst = await page.locator(".fx-skeleton").count();
  await page.goto("/services?q=panne");
  await expect(page.locator("h1")).toHaveCount(1);
  await page.locator("header a[href='/']").first().click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByTestId("domain-grid")).toBeVisible();
  const cachedReturn = await count();
  const result = { firstVisit, skeletonSeenFirst, cachedReturn };
  writeFileSync(`../../docs/design/evidence/phase12/list-replay-${process.env.AUDIT_LABEL ?? "avant"}.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
});
