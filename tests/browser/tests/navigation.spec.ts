import { expect, test, type Page } from "@playwright/test";

import { CASABLANCA, loginThroughUi, sessionInitScript, setUpProvider, uniquePhone } from "../support/journeys";

/**
 * Audit 2026-09-21 — navigation between the screens that exist, through the
 * UI and not by typing URLs (the other specs reach the provider inbox by
 * `page.goto`, which is exactly how an orphan route stays unnoticed).
 */
const ADMIN_URL = process.env.ADMIN_URL ?? "http://localhost:3001";

test.use({ geolocation: CASABLANCA, permissions: ["geolocation"] });

/** Every same-origin link on the page answers without a server error or a 404. */
async function expectInternalLinksResolve(page: Page): Promise<void> {
  const hrefs = await page.locator("a[href]").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href") ?? "").filter((href) => href.startsWith("/") || href.startsWith("#")),
  );
  for (const href of new Set(hrefs.filter((value) => value.startsWith("/")))) {
    const response = await page.request.get(new URL(href, page.url()).toString());
    expect(response.status(), href).toBeLessThan(400);
  }
  for (const anchor of new Set(hrefs.filter((value) => value.startsWith("#") && value.length > 1))) {
    await expect(page.locator(anchor), anchor).toHaveCount(1);
  }
}

test("a signed-out visitor landing on / is sent to login, and every link on it resolves", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expectInternalLinksResolve(page);
});

test("a signed-in client who clicks the logo stays signed in, on their start screen", async ({ page }) => {
  await loginThroughUi(page, uniquePhone("6"));
  await expect(page).toHaveURL(/\/requests\/new$/);

  await page.getByRole("banner").getByRole("link", { name: "Fixiyi" }).click();
  await expect(page).toHaveURL(/\/requests\/new$/);
  await expect(page.getByTestId("description-input")).toBeVisible();
  await expectInternalLinksResolve(page);
});

test("a provider opening the app reaches their inbox, not the client form", async ({ page, request }) => {
  const provider = await setUpProvider(request, uniquePhone("7"), `Nav Pro ${Date.now().toString().slice(-4)}`);
  await page.addInitScript(...sessionInitScript(provider.session));

  await page.goto("/");
  await expect(page).toHaveURL(/\/provider\/requests$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Demandes");
});

test("the admin back-office sends a signed-out visitor to its own login", async ({ page }) => {
  await page.goto(`${ADMIN_URL}/`);
  await expect(page).toHaveURL(`${ADMIN_URL}/login`);
  await expect(page.getByRole("banner").getByRole("link", { name: "Fixiyi Admin" })).toHaveAttribute("href", "/");
  await expectInternalLinksResolve(page);
});
