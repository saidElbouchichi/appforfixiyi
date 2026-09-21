import { expect, test } from "@playwright/test";

import { CASABLANCA, fillAndSubmitRequest, loginThroughUi, sessionInitScript, setUpProvider } from "../support/journeys";

test.use({ permissions: ["geolocation"], geolocation: CASABLANCA });

/**
 * Real Phase 5 scenario against the running Docker stack: a client starts a
 * search from the browser, and the provider who was actually dispatched to
 * sees it in their own browser session — with an APPROXIMATE location only
 * (01_SPEC_PRODUCT.md #17).
 *
 * The provider's ONBOARDING is done through the API, not the UI: no
 * provider onboarding screens exist yet (Phase 3 shipped the endpoints, not
 * the screens). Everything that Phase 5 actually delivers as UI is driven
 * through the browser.
 */
test("a dispatched provider sees the client's request, approximated, and can decline it", async ({ page, browser, request }) => {
  const providerPhone = `+2126${Date.now().toString().slice(-8)}`;
  const providerName = `Playwright Pro ${Date.now().toString().slice(-4)}`;

  const provider = await setUpProvider(request, providerPhone, providerName);
  expect(provider.availabilityStatus).toBe("AVAILABLE");

  // ---------------------------------------------------------------- client
  const clientPhone = `+2127${Date.now().toString().slice(-8)}`;
  await loginThroughUi(page, clientPhone);
  await expect(page).toHaveURL(/\/requests\/new$/);

  await fillAndSubmitRequest(page);
  await expect(page.getByTestId("submitted-status")).toContainText("REQUESTED", { timeout: 20_000 });
  await page.screenshot({ path: "screenshots/10-request-submitted.png", animations: "disabled" });

  await page.getByTestId("go-to-match-button").click();
  await expect(page).toHaveURL(/\/match$/);

  await page.getByTestId("start-match-button").click();
  await expect(page.getByTestId("match-status")).toContainText("ACTIVE", { timeout: 20_000 });
  await expect(page.getByTestId("candidate-list")).toContainText(providerName, { timeout: 20_000 });
  await page.screenshot({ path: "screenshots/11-match-candidates.png", animations: "disabled" });

  // A batch is a batch: the client sees a bounded number of providers, not everyone.
  const contacted = await page.getByTestId("candidate-row").count();
  expect(contacted).toBeGreaterThan(0);
  expect(contacted).toBeLessThanOrEqual(3);

  // -------------------------------------------------------------- provider
  const providerContext = await browser.newContext({ permissions: ["geolocation"], geolocation: CASABLANCA });

  /*
   * The provider's session is injected rather than re-typed through the login
   * form: their OTP was just used during API onboarding, and a second request
   * for the same number is refused for `OTP_REQUEST_COOLDOWN_SECONDS` (60s) —
   * a real anti-abuse rule (Decision 17), not something to work around by
   * sleeping. The tokens below are genuine ones issued by the real API.
   */
  await providerContext.addInitScript(...sessionInitScript(provider.session));

  const providerPage = await providerContext.newPage();
  await providerPage.goto("/provider/requests");

  const row = providerPage.getByTestId("provider-match-row").first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row).toContainText("Prise de courant");

  // 01_SPEC_PRODUCT.md #17 — rounded to ~1km, and the exact address is withheld.
  const approximate = await providerPage.getByTestId("approximate-location").first().innerText();
  expect(approximate).toContain("33.57");
  expect(approximate).not.toContain("33.5731");
  await expect(row).toContainText("Adresse exacte communiquee apres acceptation");
  await providerPage.screenshot({ path: "screenshots/12-provider-inbox.png", animations: "disabled" });

  await providerPage.getByTestId("decline-button").first().click();
  await expect(providerPage.getByTestId("provider-match-row")).toHaveCount(0, { timeout: 20_000 });
  await providerPage.screenshot({ path: "screenshots/13-provider-declined.png", animations: "disabled" });

  console.log(`Provider ${providerName} (${provider.profileId}) was dispatched to and declined through the UI.`);
  await providerContext.close();
});
