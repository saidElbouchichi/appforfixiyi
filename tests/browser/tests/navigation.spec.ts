import { expect, test, type Page } from "@playwright/test";

import {
  API_URL,
  CASABLANCA,
  fillAndSubmitRequest,
  loginThroughUi,
  readBrowserSession,
  sessionInitScript,
  setUpProvider,
  uniquePhone,
} from "../support/journeys";

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

/**
 * Design phase 7 changed what `/` is: it was a bare redirect to each role's
 * start screen, it is now the catalogue home. `startRouteFor()` still decides
 * where a fresh LOGIN lands (Decision 65) — the three tests below draw that
 * line.
 */
test("a signed-out visitor landing on / gets the home, and every link on it resolves", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("domain-grid")).toBeVisible();
  await expectInternalLinksResolve(page);
});

test("a signed-in client who clicks the logo comes home, still signed in", async ({ page }) => {
  await loginThroughUi(page, uniquePhone("6"));
  // A fresh login still lands on the client's start screen.
  await expect(page).toHaveURL(/\/requests\/new$/);

  await page.getByRole("banner").getByRole("link", { name: "Fixiyi" }).click();
  await expect(page).toHaveURL(/\/$/);
  // Still signed in: the home offers the action, not the login link.
  await expect(page.getByTestId("home-primary-action")).toContainText("Demander");
  await expectInternalLinksResolve(page);
});

test("a provider reaches their inbox from the home, and it is their start screen at login", async ({ page, request }) => {
  const provider = await setUpProvider(request, uniquePhone("7"), `Nav Pro ${Date.now().toString().slice(-4)}`);
  await page.addInitScript(...sessionInitScript(provider.session));

  await page.goto("/");
  await expect(page.getByTestId("domain-grid")).toBeVisible();

  await page.getByTestId("home-start-route").click();
  await expect(page).toHaveURL(/\/provider\/requests$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Demandes");
});

/**
 * Design rework, phase 6 — the navigation itself. Every destination below is
 * reached by clicking, never by `page.goto`: that is the only way an entry
 * that leads nowhere shows up.
 */
test("a client reaches their requests from the navigation, and the list opens the right screen", async ({ page }) => {
  await loginThroughUi(page, uniquePhone("7"));
  await fillAndSubmitRequest(page);
  await expect(page.getByTestId("submitted-status")).toContainText("REQUESTED", { timeout: 20_000 });

  const navbar = page.getByTestId("navbar");
  await expect(navbar.getByRole("link", { name: "Demander" })).toHaveAttribute("aria-current", "page");

  await navbar.getByRole("link", { name: "Mes demandes" }).click();
  await expect(page).toHaveURL(/\/requests$/);
  await expect(navbar.getByRole("link", { name: "Mes demandes" })).toHaveAttribute("aria-current", "page");

  const row = page.getByTestId("request-row").first();
  await expect(row).toContainText("Panne electrique");
  await expect(row.getByTestId("request-status")).toHaveText("Envoyee");

  await row.getByTestId("request-link").click();
  await expect(page).toHaveURL(/\/requests\/[0-9a-f-]+\/match$/, { timeout: 20_000 });
  // A detail screen stays under its list, so the user still knows where they are.
  await expect(navbar.getByRole("link", { name: "Mes demandes" })).toHaveAttribute("aria-current", "page");
  await expectInternalLinksResolve(page);
  await page.screenshot({ path: "screenshots/31-navbar-desktop.png", animations: "disabled" });
});

test("the navigation holds at tablet width and in Arabic reading order", async ({ browser, request }) => {
  const provider = await setUpProvider(request, uniquePhone("6"), `Nav RTL ${Date.now().toString().slice(-4)}`);
  const context = await browser.newContext({ viewport: { width: 768, height: 900 } });
  await context.addInitScript(...sessionInitScript(provider.session));
  const page = await context.newPage();

  await page.goto("/provider/requests");
  // 768px is exactly where the bottom bar gives way to the header's navigation.
  await expect(page.getByTestId("navbar")).toBeVisible();
  await expect(page.getByTestId("bottom-nav")).toBeHidden();
  await page.screenshot({ path: "screenshots/32-nav-tablet.png", animations: "disabled" });

  await page.evaluate(() => {
    document.documentElement.dir = "rtl";
  });
  await expect(page.getByTestId("navbar")).toBeVisible();
  await page.screenshot({ path: "screenshots/33-nav-rtl.png", animations: "disabled" });
  await context.close();
});

test("a provider on a phone gets the bottom bar, and every entry of it answers", async ({ browser, request }) => {
  const provider = await setUpProvider(request, uniquePhone("6"), `Nav Phone ${Date.now().toString().slice(-4)}`);
  const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
  await context.addInitScript(...sessionInitScript(provider.session));
  const page = await context.newPage();

  await page.goto("/provider/requests");

  const bottomNav = page.getByTestId("bottom-nav");
  await expect(bottomNav).toBeVisible();
  // The desktop bar is the same list, hidden at this width — never a second, divergent menu.
  await expect(page.getByTestId("navbar")).toBeHidden();
  await expect(bottomNav.getByRole("link")).toHaveCount(5);
  await expect(bottomNav.getByRole("link", { name: "Demandes recues" })).toHaveAttribute("aria-current", "page");

  await bottomNav.getByRole("link", { name: "Messages" }).click();
  await expect(page).toHaveURL(/\/conversations$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Messages");
  await expect(bottomNav.getByRole("link", { name: "Messages" })).toHaveAttribute("aria-current", "page");

  await bottomNav.getByRole("link", { name: "Profil" }).click();
  await expect(page).toHaveURL(/\/profile$/);

  // Five entries on a 360px screen wrap a label onto two lines: the bar must
  // be tall enough to hold them, and each target stays 44px (WCAG 2.2 AA 2.5.8).
  const barBox = await bottomNav.boundingBox();
  for (const link of await bottomNav.getByRole("link").all()) {
    const box = await link.boundingBox();
    expect(box, "every entry is laid out").not.toBeNull();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual((barBox?.y ?? 0) + (barBox?.height ?? 0) + 0.5);
  }
  await page.screenshot({ path: "screenshots/30-bottom-nav-phone.png", animations: "disabled" });
  await context.close();
});

test("the profile signs the user out for good: the session is dead on the server too", async ({ page, request }) => {
  await loginThroughUi(page, uniquePhone("7"));
  // The session is persisted as the login redirect lands; reading it earlier races that write.
  await expect(page).toHaveURL(/\/requests\/new$/, { timeout: 20_000 });
  const session = await readBrowserSession(page);
  const refreshToken = await page.evaluate(() => {
    const raw = window.localStorage.getItem("fixiyi-web-auth") ?? "{}";
    return (JSON.parse(raw) as { state?: { refreshToken?: string } }).state?.refreshToken ?? "";
  });

  await page.getByTestId("navbar").getByRole("link", { name: "Profil" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  // Sign-in is phone OTP, so an account usually has no email — the screen says so rather than showing an empty field.
  await expect(page.getByTestId("profile-email")).toContainText(/@|Aucun e-mail renseigne/);

  await page.getByTestId("sign-out-button").click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 20_000 });
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId("navbar")).toBeHidden();

  const refused = await request.post(`${API_URL}/api/v1/auth/refresh`, { data: { refreshToken } });
  expect(refused.status()).toBe(401);
  const me = await request.get(`${API_URL}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
  expect(me.status()).toBe(401);
});

test("the unread badge follows real messages, and clears once they are read", async ({ page, browser, request }) => {
  const providerName = `Nav Badge ${Date.now().toString().slice(-4)}`;
  const provider = await setUpProvider(request, uniquePhone("6"), providerName);

  await loginThroughUi(page, uniquePhone("7"));
  await fillAndSubmitRequest(page);
  await expect(page.getByTestId("submitted-status")).toContainText("REQUESTED", { timeout: 20_000 });
  const requestId = (await page.getByTestId("submitted-request-id").innerText()).trim();

  const client = await readBrowserSession(page);
  const started = await request.post(`${API_URL}/api/v1/requests/${requestId}/match`, {
    headers: { Authorization: `Bearer ${client.accessToken}` },
    data: { mode: "DIRECT", providerId: provider.profileId },
  });
  expect(started.status()).toBe(201);

  // The client opens the conversation, then walks away from it.
  await page.goto(`/requests/${requestId}/match`);
  await expect(page.getByTestId("candidate-list")).toContainText(providerName, { timeout: 20_000 });
  await page.getByTestId("chat-with-provider-button").first().click();
  await expect(page).toHaveURL(/\/conversations\/[0-9a-f-]+$/, { timeout: 20_000 });
  const conversationUrl = page.url();
  await page.getByTestId("navbar").getByRole("link", { name: "Mes demandes" }).click();
  await expect(page).toHaveURL(/\/requests$/);

  const providerContext = await browser.newContext();
  await providerContext.addInitScript(...sessionInitScript(provider.session));
  const providerPage = await providerContext.newPage();
  await providerPage.goto(conversationUrl);
  await providerPage.getByTestId("composer-input").fill("Bonjour, je peux passer demain matin.");
  await providerPage.getByTestId("send-button").click();

  // No reload: the socket notifies, the count is re-read from the API (#49).
  const messages = page.getByTestId("navbar").getByRole("link", { name: /Messages/ });
  await expect(messages).toContainText("1 non lu", { timeout: 20_000 });

  await messages.click();
  await expect(page).toHaveURL(/\/conversations$/);
  await expect(page.getByTestId("conversation-row").first()).toContainText(providerName);
  await page.getByTestId("conversation-link").first().click();
  await expect(page.getByTestId("message-bubble").last()).toContainText("demain matin", { timeout: 20_000 });

  // Reading the thread clears the badge — the same count, back from the API.
  await expect(page.getByTestId("navbar").getByRole("link", { name: /Messages/ })).not.toContainText("non lu", { timeout: 20_000 });
  await providerContext.close();
});

test("the admin back-office sends a signed-out visitor to its own login", async ({ page }) => {
  await page.goto(`${ADMIN_URL}/`);
  await expect(page).toHaveURL(`${ADMIN_URL}/login`);
  await expect(page.getByRole("banner").getByRole("link", { name: "Fixiyi Admin" })).toHaveAttribute("href", "/");
  await expectInternalLinksResolve(page);
});
