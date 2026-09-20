import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PHOTO = path.join(__dirname, "..", "fixtures", "photo.png");

/**
 * Real end-to-end browser scenario against the running Docker stack
 * (`apps/web` on :3000, `apps/api` on :4000, real MongoDB/Redis/MinIO) —
 * PHASE_4_PLAN.md step 6/9. No mocked network layer: every screen
 * transition below is driven by a real API call.
 */
test.use({ permissions: ["geolocation"], geolocation: { latitude: 33.573109, longitude: -7.589843 } });

test("client logs in with OTP and creates a service request with a real photo upload", async ({ page }) => {
  page.on("pageerror", (err) => {
    console.log(`BROWSER PAGE ERROR: ${err.message}`);
  });

  const phone = `+2126${Date.now().toString().slice(-8)}`;

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.screenshot({ path: "screenshots/01-login-phone.png" });

  await page.getByTestId("phone-input").fill(phone);
  await page.getByTestId("request-otp-button").click();

  const devCodeText = await page.getByTestId("dev-code").innerText();
  const code = /\d{6}/.exec(devCodeText)?.[0];
  if (!code) {
    throw new Error(`Could not read a 6-digit dev OTP code from: "${devCodeText}"`);
  }
  await page.screenshot({ path: "screenshots/02-login-otp.png" });

  await page.getByTestId("otp-input").fill(code);
  await page.getByTestId("verify-otp-button").click();
  await expect(page).toHaveURL(/\/requests\/new$/);

  const domainSelect = page.getByTestId("domain-select");
  await expect(domainSelect.locator("option")).not.toHaveCount(1, { timeout: 15_000 });

  await domainSelect.selectOption({ label: "Electricite" });
  await page.getByTestId("category-select").selectOption({ label: "Panne electrique" });
  await page.getByTestId("service-select").selectOption({ label: "Panne electrique" });
  await page.getByTestId("intervention-type-select").selectOption({ label: "Diagnostic / reparation" });
  await page.getByTestId("complexity-select").selectOption({ label: "Simple" });

  await page.getByTestId("description-input").fill("Prise de courant ne fonctionne plus depuis hier.");
  await page.getByTestId("address-input").fill("12 rue des Fleurs, Casablanca");

  await page.getByTestId("use-my-location-button").click();
  await expect(page.getByTestId("coordinates-display")).toContainText("33.573", { timeout: 10_000 });

  await page.getByTestId("media-input").setInputFiles(FIXTURE_PHOTO);
  await page.screenshot({ path: "screenshots/03-form-filled.png" });

  await page.getByTestId("submit-request-button").click();

  await expect(page.getByTestId("submitted-status")).toContainText("REQUESTED", { timeout: 20_000 });
  await expect(page.getByTestId("submitted-media-count")).toContainText("1");
  await page.screenshot({ path: "screenshots/04-request-submitted.png" });

  const requestId = await page.getByTestId("submitted-request-id").innerText();
  console.log(`Created and submitted ServiceRequest id: ${requestId} (phone ${phone})`);
});
