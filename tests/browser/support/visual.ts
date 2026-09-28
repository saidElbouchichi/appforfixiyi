import { fileURLToPath } from "node:url";

import type { Locator, Page } from "@playwright/test";

import { expect } from "./test";

/**
 * Named captures (design phase 15, Decision 87).
 *
 * Every run writes `screenshots/<name>.png`: the step captures kept in the
 * repository, as before. Inside the Linux image (`tests/browser/Dockerfile`,
 * `VISUAL=1`) the same screen is also compared with its reference in
 * `visual/`. Outside it nothing is compared: fonts rasterise differently on
 * Windows and macOS, and a reference only means something against the
 * renderer that produced it.
 */
const COMPARES = process.env.VISUAL === "1";
const NORMALISE = fileURLToPath(new URL("./visual.css", import.meta.url));

export interface CaptureOptions {
  fullPage?: boolean;
  /** Data that changes on every run (a generated phone, a date, a generated name): hidden from the comparison only. */
  mask?: Locator[];
}

export async function capture(
  page: Page,
  name: string,
  options: CaptureOptions = {},
): Promise<void> {
  const { fullPage = false, mask = [] } = options;
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage, animations: "disabled" });
  if (COMPARES) {
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage, mask, stylePath: NORMALISE });
  }
}
