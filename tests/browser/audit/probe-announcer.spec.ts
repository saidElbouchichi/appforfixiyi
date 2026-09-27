import { test } from "@playwright/test";
import { loginThroughUi, uniquePhone } from "../support/journeys";
// Why did the announcer "match" the title before any fix? Record it at each step.
test("announcer history", async ({ page }) => {
  const heard = async () => page.evaluate(() => document.getElementsByTagName("next-route-announcer")[0]?.shadowRoot?.textContent ?? "(absent)");
  await page.goto("/login", { waitUntil: "networkidle" });
  console.log("login load:", JSON.stringify(await heard()), await page.title());
  await loginThroughUi(page, uniquePhone("7"));
  await page.waitForURL(/requests\/new/);
  console.log("after login redirect:", JSON.stringify(await heard()), await page.title());
  await page.locator("header a[href='/requests']").first().click();
  await page.waitForURL(/\/requests$/);
  console.log("after /requests:", JSON.stringify(await heard()), await page.title());
});
