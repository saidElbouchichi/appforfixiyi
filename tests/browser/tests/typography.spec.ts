import { expect, test, type Page } from "@playwright/test";

/**
 * Design phase 2 (docs/design/PHASE_2_REPORT.md): the fonts are really
 * served by next/font from the app itself, and the token stacks really
 * reach them. jsdom cannot answer either question — only a browser can.
 */
const APPS = [
  { name: "web", url: process.env.WEB_URL ?? "http://localhost:3000" },
  { name: "admin", url: process.env.ADMIN_URL ?? "http://localhost:3001" },
] as const;

/** Families of the font faces the browser has actually finished loading. */
async function loadedFamilies(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((face) => face.status === "loaded").map((face) => face.family.replace(/["']/g, ""));
  });
}

for (const app of APPS) {
  test.describe(`${app.name} — typography`, () => {
    test("renders the body in Inter, self-hosted by the app", async ({ page }) => {
      const fontRequests: string[] = [];
      page.on("request", (request) => {
        if (request.resourceType() === "font") fontRequests.push(request.url());
      });

      await page.goto(`${app.url}/login`);

      // The token stack resolved through the variable next/font sets on <html>.
      const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
      expect(bodyFont).toMatch(/Inter/);
      // next/font appends its metric-matched fallback: proof the variable reached the stack.
      expect(bodyFont).toMatch(/Inter Fallback/);

      const families = await loadedFamilies(page);
      expect(families.some((family) => family.includes("Inter"))).toBe(true);

      // Self-hosted: no font is fetched from a third-party origin.
      expect(fontRequests.length).toBeGreaterThan(0);
      for (const url of fontRequests) expect(new URL(url).origin).toBe(new URL(app.url).origin);
    });

    test("switches Arabic content to Noto Sans Arabic, loaded on demand", async ({ page }) => {
      await page.goto(`${app.url}/login`);
      expect((await loadedFamilies(page)).some((family) => family.includes("Noto Sans Arabic"))).toBe(false);

      await page.evaluate(() => {
        const sample = document.createElement("p");
        sample.lang = "ar";
        sample.dataset.testid = "arabic-sample";
        sample.textContent = "مرحبا بكم في فيكسيي";
        document.body.append(sample);
      });

      const sampleFont = await page.getByTestId("arabic-sample").evaluate((element) => getComputedStyle(element).fontFamily);
      expect(sampleFont.split(",")[0]).toMatch(/Noto Sans Arabic/);
      await expect.poll(async () => (await loadedFamilies(page)).some((family) => family.includes("Noto Sans Arabic"))).toBe(true);
    });
  });
}
