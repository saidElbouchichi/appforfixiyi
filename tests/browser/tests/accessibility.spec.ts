import AxeBuilder from "@axe-core/playwright";
import { type Browser, type Page } from "@playwright/test";

import { API_URL, CASABLANCA, fillAndSubmitRequest, loginThroughUi, readBrowserSession, sessionInitScript, setUpProvider, uniquePhone } from "../support/journeys";
import { expect, test } from "../support/test";

/**
 * Design phase 11 — accessibility, measured on every screen with real data.
 *
 * axe-core covers what a rule engine can decide (contrast, names, roles). The
 * rest is what the phase's audit found and axe does not look at: the heading
 * outline, the page title a screen reader hears on navigation, and reflow at
 * 320 CSS px (WCAG 1.4.10 — the phase 10 perimeter started at 360).
 */
test.use({ geolocation: CASABLANCA, permissions: ["geolocation"] });
test.setTimeout(300_000);

const ADMIN_URL = process.env.ADMIN_URL ?? "http://localhost:3001";
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
/** 1280 CSS px at 400 % zoom (WCAG 1.4.10). */
const REFLOW_WIDTH = 320;
const DESKTOP_WIDTH = 1440;

interface Outline {
  title: string;
  lang: string | null;
  h1: number;
  jumps: string[];
}

async function outline(page: Page): Promise<Outline> {
  return page.evaluate(() => {
    const headings = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")];
    const levels = headings.map((h) => Number(h.tagName[1]));
    const jumps: string[] = [];
    for (let i = 1; i < levels.length; i += 1) {
      if (levels[i] > levels[i - 1] + 1) jumps.push(`h${levels[i - 1].toString()} -> h${levels[i].toString()} "${(headings[i].textContent ?? "").trim()}"`);
    }
    return { title: document.title, lang: document.documentElement.getAttribute("lang"), h1: levels.filter((l) => l === 1).length, jumps };
  });
}

/** Checks one screen at both ends of the range; returns its title. */
async function expectAccessible(page: Page, path: string, ready: () => Promise<void>): Promise<string> {
  let title = "";
  for (const width of [REFLOW_WIDTH, DESKTOP_WIDTH]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(path, { waitUntil: "networkidle" });
    await ready();
    // Measure settled colours: mid-way through its entry animation, a sent bubble
    // read 3.98:1 — a blend of the orange and the page, not a colour of the product.
    await page.evaluate(async () => {
      // Finite ones only: a spinner or a pulse never finishes.
      const finite = document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity);
      await Promise.all(finite.map((animation) => animation.finished));
    });
    const where = `${path} @ ${width.toString()}px`;

    const axe = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    const violations = axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    expect.soft(violations, `${where}: axe WCAG 2.2 AA`).toEqual([]);

    const found = await outline(page);
    expect.soft(found.lang, `${where}: page language`).toBe("fr");
    expect.soft(found.h1, `${where}: exactly one h1`).toBe(1);
    expect.soft(found.jumps, `${where}: heading levels skipped (1.3.1)`).toEqual([]);

    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect.soft(sideways, `${where}: the page scrolls sideways (1.4.10)`).toBeLessThanOrEqual(1);
    title = found.title;
  }
  return title;
}

async function freshClient(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ geolocation: CASABLANCA, permissions: ["geolocation"] });
  const page = await context.newPage();
  await loginThroughUi(page, uniquePhone("7"));
  await expect(page).toHaveURL(/\/requests\/new$/, { timeout: 20_000 });
  return page;
}

test("every screen passes axe, keeps its outline, reflows at 320px and has a title of its own", async ({ page, browser, request }) => {
  const titles = new Map<string, string>();
  const h1 = (p: Page) => async (): Promise<void> => {
    await expect(p.locator("h1")).toHaveCount(1, { timeout: 20_000 });
  };

  titles.set("/", await expectAccessible(page, "/", h1(page)));
  titles.set("/services", await expectAccessible(page, "/services?q=panne", h1(page)));
  titles.set("/login", await expectAccessible(page, "/login", h1(page)));

  // A client with a request, a DIRECT match and a conversation.
  const providerName = `A11y Pro ${Date.now().toString().slice(-4)}`;
  const provider = await setUpProvider(request, uniquePhone("6"), providerName);
  await loginThroughUi(page, uniquePhone("7"));
  await expect(page).toHaveURL(/\/requests\/new$/, { timeout: 20_000 });
  await fillAndSubmitRequest(page);
  await expect(page.getByTestId("submitted-status")).toContainText("REQUESTED", { timeout: 20_000 });
  const requestId = (await page.getByTestId("submitted-request-id").innerText()).trim();
  const client = await readBrowserSession(page);
  const started = await request.post(`${API_URL}/api/v1/requests/${requestId}/match`, {
    headers: { Authorization: `Bearer ${client.accessToken}` },
    data: { mode: "DIRECT", providerId: provider.profileId },
  });
  expect(started.status()).toBe(201);
  await page.goto(`/requests/${requestId}/match`);
  await page.getByTestId("chat-with-provider-button").first().click({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/conversations\/[0-9a-f-]+$/, { timeout: 20_000 });
  const conversation = new URL(page.url()).pathname;

  // The conversation before its first message: the empty state sits under the h1.
  titles.set("/conversations/:id", await expectAccessible(page, conversation, async () => {
    await expect(page.getByText("Aucun message")).toBeVisible({ timeout: 20_000 });
  }));
  await page.getByTestId("composer-input").fill("Bonjour, j'ai une question");
  await page.getByTestId("send-button").click();
  await expect(page.getByTestId("message-item")).toHaveCount(1, { timeout: 10_000 });
  // ...then a reply to it: the sender's own bubble, its time stamp, the quote
  // it carries (the quoted excerpt is dimmed text on the action colour), the list.
  await page.getByTestId("reply-button").first().click();
  await page.getByTestId("composer-input").fill("Et une precision");
  await page.getByTestId("send-button").click();
  await expect(page.getByTestId("message-item")).toHaveCount(2, { timeout: 10_000 });
  await expectAccessible(page, conversation, async () => {
    await expect(page.getByTestId("message-item")).toHaveCount(2, { timeout: 20_000 });
    await expect(page.locator(".fx-reply-quote")).toHaveCount(1);
  });

  titles.set("/requests/new", await expectAccessible(page, "/requests/new", h1(page)));
  titles.set("/requests", await expectAccessible(page, "/requests", h1(page)));
  titles.set("/requests/:id/match", await expectAccessible(page, `/requests/${requestId}/match`, h1(page)));
  titles.set("/profile", await expectAccessible(page, "/profile", h1(page)));
  titles.set("/providers/:id", await expectAccessible(page, `/providers/${provider.profileId}`, h1(page)));

  // Empty states: a client with no conversation, a provider with no request.
  const newcomer = await freshClient(browser);
  titles.set("/conversations", await expectAccessible(newcomer, "/conversations", async () => {
    await expect(newcomer.getByText("Aucune conversation")).toBeVisible({ timeout: 20_000 });
  }));
  const idle = await setUpProvider(request, uniquePhone("6"), `A11y Idle ${Date.now().toString().slice(-4)}`, "OFFLINE");
  const providerContext = await browser.newContext();
  await providerContext.addInitScript(...sessionInitScript(idle.session));
  const providerPage = await providerContext.newPage();
  titles.set("/provider/requests", await expectAccessible(providerPage, "/provider/requests", async () => {
    await expect(providerPage.getByText("Aucune demande pour le moment")).toBeVisible({ timeout: 20_000 });
  }));

  // WCAG 2.4.2: a title describes its page, so no two routes share one.
  const shared = [...titles].filter(([, title], _, all) => all.filter(([, other]) => other === title).length > 1);
  expect(shared, "routes sharing a title (2.4.2)").toEqual([]);
  // ...and each names the site too. A nested segment once lost the suffix: a
  // parent layout's plain-string title drops the root template for its children.
  const unsuffixed = [...titles].filter(([route, title]) => route !== "/" && !title.endsWith(" — Fixiyi"));
  expect(unsuffixed, "titles without the site name").toEqual([]);

  // Other specs compete for the bounded dispatch batch: leave nothing dispatchable behind.
  await request.patch(`${API_URL}/api/v1/providers/me/availability`, {
    headers: { Authorization: `Bearer ${provider.session.accessToken}` },
    data: { status: "OFFLINE" },
  });
});

/**
 * Next's route announcer reads `document.title` after a client-side
 * navigation — and only when it changed. With one title for every route it
 * was silent: a screen reader heard nothing when the page changed.
 */
test("a screen reader hears the new page's title after a client-side navigation", async ({ page }) => {
  const heard = async (): Promise<string> =>
    page.evaluate(() => document.getElementsByTagName("next-route-announcer")[0]?.shadowRoot?.textContent ?? "");

  await loginThroughUi(page, uniquePhone("7"));
  await expect(page).toHaveURL(/\/requests\/new$/, { timeout: 20_000 });
  await page.setViewportSize({ width: DESKTOP_WIDTH, height: 900 });

  // The live region keeps its last text: an announcement made during the login
  // redirect ("Fixiyi") stayed there, and matched a title that never changed.
  // That false green is why each step must also bring a NEW title.
  let previous = await page.title();
  for (const href of ["/requests", "/conversations", "/profile"]) {
    await page.locator(`header a[href='${href}']`).first().click();
    await page.waitForURL((url) => url.pathname === href);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect.poll(() => page.title(), { message: `a title of its own for ${href}` }).not.toBe(previous);
    const title = await page.title();
    await expect.poll(heard, { message: `announcer after navigating to ${href}` }).toBe(title);
    previous = title;
  }
});

test("the admin back-office names its pages too", async ({ page }) => {
  await page.goto(`${ADMIN_URL}/login`, { waitUntil: "networkidle" });
  const loginTitle = await page.title();
  expect(loginTitle, "admin login title").not.toBe("Fixiyi Admin");
  expect(loginTitle).toContain("Fixiyi Admin");
});
