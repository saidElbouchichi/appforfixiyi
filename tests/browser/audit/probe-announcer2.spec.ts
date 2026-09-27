import { expect, test } from "@playwright/test";
import { loginThroughUi, uniquePhone } from "../support/journeys";
test("same steps as the spec, logged", async ({ page }) => {
  const heard = async (): Promise<string> =>
    page.evaluate(() => document.getElementsByTagName("next-route-announcer")[0]?.shadowRoot?.textContent ?? "");
  await loginThroughUi(page, uniquePhone("7"));
  await expect(page).toHaveURL(/\/requests\/new$/, { timeout: 20_000 });
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const href of ["/requests", "/conversations", "/profile"]) {
    await page.locator(`header a[href='${href}']`).first().click();
    await page.waitForURL((url) => url.pathname === href);
    await expect(page.locator("h1")).toHaveCount(1);
    const n = await page.evaluate(() => document.getElementsByTagName("next-route-announcer").length);
    console.log(href, "title=", JSON.stringify(await page.title()), "heard=", JSON.stringify(await heard()), "announcers=", n,
      "text of all:", JSON.stringify(await page.evaluate(() => [...document.getElementsByTagName("next-route-announcer")].map((h) => h.shadowRoot?.textContent))));
  }
});
