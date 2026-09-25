import { expect, test, type Page } from "@playwright/test";

import { CASABLANCA, fillAndSubmitRequest, loginThroughUi, uniquePhone } from "../support/journeys";

/**
 * Design phase 10 — responsive, measured rather than looked at.
 *
 * Not a visual test: nothing here compares images (those come after phase 14).
 * It reads numbers out of the DOM — the same four criteria the phase's audit
 * used, which is what makes this a regression test for that audit.
 *
 * The audit itself found only two real defects across 44 route x viewport
 * measurements; this exists so that stays true.
 */
test.use({ geolocation: CASABLANCA, permissions: ["geolocation"] });

const PHONE_WIDTH = 360;
const DESKTOP_WIDTH = 1440;

/** WCAG 2.5.8 minimum; `styles.css` aims at 44, so this is the floor, not the goal. */
const MIN_TARGET = 24;

interface Measurement {
  pageWidth: number;
  viewport: number;
  overflowing: string[];
  clipped: string[];
  smallTargets: string[];
}

async function measure(page: Page): Promise<Measurement> {
  return page.evaluate(() => {
    const viewport = window.innerWidth;
    const describe = (el: Element): string => {
      const id = el.getAttribute("data-testid");
      return `${el.tagName.toLowerCase()}${id ? `[${id}]` : ""}: ${(el.textContent ?? "").trim().slice(0, 40)}`;
    };

    const overflowing: string[] = [];
    const clipped: string[] = [];
    const smallTargets: string[] = [];

    for (const el of document.querySelectorAll("body *")) {
      // The screen-reader-only pattern is 1x1 with clip-path: it is not a defect.
      // Leaving it in produced nine false findings during the phase's audit.
      if (el.classList.contains("fx-visually-hidden") || el.closest(".fx-visually-hidden")) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(el);

      if (rect.right > viewport + 1 && style.position !== "fixed") overflowing.push(describe(el));

      const scrolls = style.overflowX === "auto" || style.overflowX === "scroll";
      if (!scrolls && el.children.length === 0 && el.scrollWidth > el.clientWidth + 1) clipped.push(describe(el));

      // A control's target is what a finger can hit: for a control wrapped in a
      // label, that is the label. The audit's first pass flagged 13px radios
      // that sit inside 44px labels — a false positive this check avoids.
      if (el.matches("a, button, [role=button], [role=tab]") || (el.matches("input, select, textarea") && !el.closest("label"))) {
        if (rect.width < 24 || rect.height < 24) smallTargets.push(`${describe(el)} (${Math.round(rect.width)}x${Math.round(rect.height)})`);
      }
    }

    return {
      pageWidth: document.documentElement.scrollWidth,
      viewport,
      overflowing: [...new Set(overflowing)],
      clipped: [...new Set(clipped)],
      smallTargets: [...new Set(smallTargets)],
    };
  });
}

function expectClean(result: Measurement, where: string): void {
  expect(result.pageWidth, `${where}: the page scrolls sideways`).toBeLessThanOrEqual(result.viewport + 1);
  expect(result.overflowing, `${where}: element past the right edge`).toEqual([]);
  expect(result.clipped, `${where}: text cut off by its own box`).toEqual([]);
  expect(result.smallTargets, `${where}: target under ${MIN_TARGET.toString()}px`).toEqual([]);
}

test("the public screens hold from a phone to a wide desktop", async ({ browser }) => {
  for (const width of [PHONE_WIDTH, DESKTOP_WIDTH]) {
    const context = await browser.newContext({ viewport: { width, height: width < 500 ? 780 : 900 } });
    const page = await context.newPage();
    for (const path of ["/", "/services?q=panne", "/login"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      expectClean(await measure(page), `${path} @ ${width.toString()}px`);
    }
    await context.close();
  }
});

/**
 * The defect this phase fixed. A description holding a token with no space —
 * a pasted URL, a serial number — used to be cut off mid-word inside the card,
 * which hides its overflow: `scrollWidth` 797 against `clientWidth` 270, with
 * nothing widening the page to give it away.
 */
test("a word with no space in it wraps instead of being cut off", async ({ page }) => {
  await loginThroughUi(page, uniquePhone("6"));
  await fillAndSubmitRequest(page, { description: `Reparation${"X".repeat(60)}Urgente, prise qui fait des etincelles.` });
  await expect(page.getByTestId("submitted-status")).toContainText("REQUESTED", { timeout: 20_000 });

  await page.setViewportSize({ width: PHONE_WIDTH, height: 780 });
  await page.goto("/requests", { waitUntil: "networkidle" });
  await expect(page.getByTestId("request-row").first()).toBeVisible();

  expectClean(await measure(page), `/requests with an unbreakable word @ ${PHONE_WIDTH.toString()}px`);
});

test("the file picker is a real target, not a 20px native control", async ({ page }) => {
  await loginThroughUi(page, uniquePhone("6"));
  await page.setViewportSize({ width: PHONE_WIDTH, height: 780 });
  await page.goto("/requests/new", { waitUntil: "networkidle" });

  // The target is the label: clicking anywhere on it opens the picker, border
  // included. The input is the overlay inside it, so it measures two pixels
  // less — measuring the input would be measuring the wrong thing.
  const target = page.locator("label.fx-file-picker");
  const targetBox = await target.boundingBox();
  expect(targetBox?.height ?? 0, "the file picker's hit area").toBeGreaterThanOrEqual(44);

  // Still a real input underneath, which is what the upload journey drives.
  const input = page.getByTestId("media-input");
  await expect(input).toHaveAttribute("type", "file");
  expect(await input.boundingBox(), "the input keeps a box, so setInputFiles still works").not.toBeNull();
});
