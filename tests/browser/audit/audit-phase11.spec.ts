import { writeFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { API_URL, CASABLANCA, fillAndSubmitRequest, loginThroughUi, readBrowserSession, sessionInitScript, setUpProvider, uniquePhone } from "../support/journeys";

/**
 * Phase 11 audit harness — NOT the regression suite (see audit/playwright.config.ts).
 * Measures, with real sessions against the Docker stack, what the phase report
 * cites. Output: docs/design/evidence/phase11/audit-<label>.json.
 */
const OUT = "../../docs/design/evidence/phase11";
const LABEL = process.env.AUDIT_LABEL ?? "avant";
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const WIDTHS = [360, 1440];

test.use({ geolocation: CASABLANCA, permissions: ["geolocation"] });
test.setTimeout(600_000);

interface Structure {
  title: string;
  lang: string | null;
  h1: number;
  headings: string[];
  headingJumps: string[];
  landmarks: Record<string, number>;
  smallTargets: string[];
}

async function structure(page: Page): Promise<Structure> {
  return page.evaluate(() => {
    const visible = (el: Element): boolean => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const headings = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")];
    const levels = headings.map((h) => Number(h.tagName[1]));
    const headingJumps: string[] = [];
    for (let i = 1; i < levels.length; i += 1) {
      if (levels[i] > levels[i - 1] + 1) headingJumps.push(`h${levels[i - 1].toString()} -> h${levels[i].toString()} "${(headings[i].textContent ?? "").trim().slice(0, 40)}"`);
    }
    const count = (selector: string): number => document.querySelectorAll(selector).length;
    const smallTargets: string[] = [];
    for (const el of document.querySelectorAll("a, button, [role=button], [role=tab], input, select, textarea")) {
      if (el.closest(".fx-visually-hidden") || !visible(el)) continue;
      // WCAG measures the clickable target: for a control inside a label, the label.
      const target = el.matches("input, select, textarea") ? (el.closest("label") ?? el) : el;
      const r = target.getBoundingClientRect();
      if (r.width < 24 || r.height < 24) smallTargets.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 30)}" ${Math.round(r.width).toString()}x${Math.round(r.height).toString()}`);
    }
    return {
      title: document.title,
      lang: document.documentElement.getAttribute("lang"),
      h1: count("h1"),
      headings: headings.map((h, i) => `h${levels[i].toString()} ${(h.textContent ?? "").trim().slice(0, 40)}`),
      headingJumps,
      landmarks: { main: count("main"), banner: count("header, [role=banner]"), navigation: count("nav"), contentinfo: count("footer, [role=contentinfo]") },
      smallTargets,
    };
  });
}

interface KeyboardWalk {
  firstStop: string;
  stops: number;
  withoutRing: string[];
  obscured: string[];
  trapped: boolean;
}

/** Tabs through the page: ring on every stop (2.4.7), not entirely hidden (2.4.11), no trap (2.1.2). */
async function keyboardWalk(page: Page, maxStops = 60): Promise<KeyboardWalk> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  const seen: string[] = [];
  const withoutRing: string[] = [];
  const obscured: string[] = [];
  let repeats = 0;
  for (let i = 0; i < maxStops; i += 1) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const ring = (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none";
      const r = el.getBoundingClientRect();
      const points = [
        [r.left + r.width / 2, r.top + r.height / 2],
        [r.left + 2, r.top + 2],
        [r.right - 2, r.top + 2],
        [r.left + 2, r.bottom - 2],
        [r.right - 2, r.bottom - 2],
      ];
      const shown = points.some(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return hit !== null && (hit === el || el.contains(hit) || hit.contains(el));
      });
      const name = `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}"`;
      return { key: `${name}@${Math.round(r.top + window.scrollY).toString()}`, name, ring, shown };
    });
    if (!stop) break;
    if (seen.length > 0 && seen[seen.length - 1] === stop.key) {
      repeats += 1;
      if (repeats >= 3) break;
      continue;
    }
    if (seen.includes(stop.key)) break; // wrapped around: the walk is complete
    seen.push(stop.key);
    if (!stop.ring) withoutRing.push(stop.name);
    if (!stop.shown) obscured.push(stop.name);
  }
  return { firstStop: seen[0] ?? "(none)", stops: seen.length, withoutRing, obscured, trapped: repeats >= 3 };
}

async function reflowAndSpacing(page: Page, path: string): Promise<{ reflow320: boolean; zoom200: boolean; spacingClipped: string[] }> {
  const size = page.viewportSize() ?? { width: 1440, height: 900 };
  const scrollsSideways = async (width: number): Promise<boolean> => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(path, { waitUntil: "networkidle" });
    return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  };
  // 1.4.10: 1280px at 400% = 320 CSS px. 1.4.4: 1280px at 200% = 640 CSS px.
  const reflow320 = !(await scrollsSideways(320));
  const zoom200 = !(await scrollsSideways(640));
  // 1.4.12: the criterion's exact overrides, at phone width.
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(path, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }" });
  const spacingClipped = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest(".fx-visually-hidden") || el.children.length > 0) continue;
      if (!(el.textContent ?? "").trim()) continue;
      const style = getComputedStyle(el);
      const hides = (v: string): boolean => v === "hidden" || v === "clip";
      if ((hides(style.overflowX) && el.scrollWidth > el.clientWidth + 1) || (hides(style.overflowY) && el.scrollHeight > el.clientHeight + 1)) {
        out.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}"`);
      }
    }
    return out;
  });
  await page.setViewportSize(size);
  return { reflow320, zoom200, spacingClipped };
}

async function announcer(page: Page): Promise<string> {
  return page.evaluate(() => document.getElementsByTagName("next-route-announcer")[0]?.shadowRoot?.textContent ?? "(absent)");
}

async function audit(page: Page, path: string, ready: () => Promise<void>): Promise<Record<string, unknown>> {
  const perWidth: Record<string, unknown> = {};
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 500 ? 780 : 900 });
    await page.goto(path, { waitUntil: "networkidle" });
    await ready();
    const axe = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    perWidth[`${width.toString()}px`] = {
      axeViolations: axe.violations.map((v) => `${v.id} (${v.impact ?? "?"}) x${v.nodes.length.toString()}`),
      axeIncomplete: axe.incomplete.map((v) => `${v.id} x${v.nodes.length.toString()}`),
      axeRulesPassed: axe.passes.length,
      structure: await structure(page),
      keyboard: width === 1440 ? await keyboardWalk(page) : undefined,
    };
  }
  return { ...perWidth, reflowAndSpacing: await reflowAndSpacing(page, path) };
}

async function newClient(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ geolocation: CASABLANCA, permissions: ["geolocation"] });
  const page = await context.newPage();
  await loginThroughUi(page, uniquePhone("7"));
  await expect(page).toHaveURL(/\/requests\/new$/, { timeout: 20_000 });
  return page;
}

test("phase 11 audit", async ({ page, browser, request }) => {
  const results: Record<string, unknown> = {};
  const h1 = async (): Promise<void> => {
    await expect(page.locator("h1").first()).toBeAttached({ timeout: 20_000 });
  };

  // --- signed out
  results["/"] = await audit(page, "/", h1);
  results["/services?q=panne"] = await audit(page, "/services?q=panne", h1);
  results["/login"] = await audit(page, "/login", h1);

  // --- a client with a request, a DIRECT match and a conversation
  const providerName = `Audit Pro ${Date.now().toString().slice(-4)}`;
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
  await expect(page.getByTestId("candidate-list")).toContainText(providerName, { timeout: 20_000 });
  await page.getByTestId("chat-with-provider-button").first().click();
  await expect(page).toHaveURL(/\/conversations\/[0-9a-f-]+$/, { timeout: 20_000 });
  const conversationPath = new URL(page.url()).pathname;
  await page.getByTestId("composer-input").fill("Bonjour, message de l'audit");
  await page.getByTestId("send-button").click();
  await expect(page.getByTestId("message-item")).toHaveCount(1, { timeout: 10_000 });

  results["/requests/new"] = await audit(page, "/requests/new", h1);
  results["/requests"] = await audit(page, "/requests", h1);
  results["/requests/:id/match"] = await audit(page, `/requests/${requestId}/match`, h1);
  results["/conversations/:id"] = await audit(page, conversationPath, h1);
  results["/profile"] = await audit(page, "/profile", h1);
  results["/providers/:id"] = await audit(page, `/providers/${provider.profileId}`, h1);

  // 2.1.2 inside a modal: focus kept in, Escape closes and returns focus to the trigger.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(conversationPath, { waitUntil: "networkidle" });
  await page.getByTestId("edit-button").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  let escaped = 0;
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press("Tab");
    if (!(await page.evaluate(() => document.activeElement?.closest("[role=dialog]") !== null))) escaped += 1;
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  results.modal = { tabsTried: 12, focusLeftDialog: escaped, focusBackOnTrigger: await page.evaluate(() => document.activeElement?.getAttribute("data-testid")) };

  // --- empty states: a fresh client (no conversation), a fresh provider (no request)
  const freshClient = await newClient(browser);
  results["/conversations (vide)"] = await audit(freshClient, "/conversations", async () => {
    await expect(freshClient.getByText("Aucune conversation")).toBeVisible({ timeout: 20_000 });
  });
  const idle = await setUpProvider(request, uniquePhone("6"), `Audit Idle ${Date.now().toString().slice(-4)}`, "OFFLINE");
  const providerContext = await browser.newContext();
  await providerContext.addInitScript(...sessionInitScript(idle.session));
  const providerPage = await providerContext.newPage();
  results["/provider/requests (vide)"] = await audit(providerPage, "/provider/requests", async () => {
    await expect(providerPage.getByText("Aucune demande pour le moment")).toBeVisible({ timeout: 20_000 });
  });

  // --- the route announcer after client-side navigations (what a screen reader hears)
  const heard: Record<string, string> = {};
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "networkidle" });
  for (const href of ["/requests", "/conversations", "/profile", "/"]) {
    await page.locator(`header a[href='${href}']`).first().click();
    await page.waitForURL((url) => url.pathname === href);
    await page.waitForLoadState("networkidle");
    heard[href] = `title="${await page.title()}" announcer="${await announcer(page)}"`;
  }
  await page.locator("main a[href^='/services']").first().click();
  await page.waitForURL(/\/services/);
  await page.waitForLoadState("networkidle");
  heard["tuile -> /services"] = `title="${await page.title()}" announcer="${await announcer(page)}" focus=${await page.evaluate(() => document.activeElement?.tagName.toLowerCase() ?? "null")}`;
  results.announcer = heard;

  // Leave nothing dispatchable behind: other specs compete for the bounded batch.
  await request.patch(`${API_URL}/api/v1/providers/me/availability`, {
    headers: { Authorization: `Bearer ${provider.session.accessToken}` },
    data: { status: "OFFLINE" },
  });

  writeFileSync(`${OUT}/audit-${LABEL}.json`, JSON.stringify(results, null, 2));
});
