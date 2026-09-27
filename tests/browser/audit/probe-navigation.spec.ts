import { writeFileSync } from "node:fs";
import { test } from "@playwright/test";

const OUT = "../../docs/design/evidence/phase11";

async function announcer(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate(() => {
    const host = document.getElementsByTagName("next-route-announcer")[0];
    return host?.shadowRoot?.textContent ?? "(no announcer)";
  });
}
async function active(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return "null";
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} "${(el.textContent ?? "").trim().slice(0, 40)}"`;
  });
}

test("what happens after a client-side navigation", async ({ page }) => {
  const log: Record<string, unknown> = {};
  await page.goto("/", { waitUntil: "networkidle" });
  log.homeTitle = await page.title();
  log.announcerBefore = await announcer(page);

  // In-content link (removed by the navigation): a service tile.
  const tile = page.locator("main a[href^='/services']").first();
  log.tileHref = await tile.getAttribute("href");
  await tile.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/services/);
  await page.waitForLoadState("networkidle");
  log.afterTile = { url: page.url(), title: await page.title(), active: await active(page), announcer: await announcer(page) };
  await page.keyboard.press("Tab");
  log.afterTileFirstTab = await active(page);

  // Persistent link (header navigation).
  await page.goto("/services", { waitUntil: "networkidle" });
  const headerLink = page.locator("header a[href='/']").first();
  await headerLink.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => u.pathname === "/");
  await page.waitForLoadState("networkidle");
  log.afterHeader = { url: page.url(), title: await page.title(), active: await active(page), announcer: await announcer(page) };
  await page.keyboard.press("Tab");
  log.afterHeaderFirstTab = await active(page);

  writeFileSync(`${OUT}/probe-navigation.json`, JSON.stringify(log, null, 2));
  console.log(JSON.stringify(log, null, 2));
});
