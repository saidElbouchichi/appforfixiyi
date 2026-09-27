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

/*
 * Phase 11 diagnosis: the two intermittent Playwright failures, made deterministic.
 * Each probe reproduces the condition on purpose and logs what the OLD test code and
 * the NEW one would see, so the fix is shown to bite rather than assumed to.
 */
test.use({ permissions: ["geolocation"], geolocation: CASABLANCA });

/** The helper as it was: it returned at the click, before the verification answered. */
async function legacyLogin(page: Page, phone: string): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("phone-input").fill(phone);
  await page.getByTestId("request-otp-button").click();
  const code = /\d{6}/.exec(await page.getByTestId("dev-code").innerText())?.[0] ?? "";
  await page.getByTestId("otp-input").fill(code);
  await page.getByTestId("verify-otp-button").click();
}

async function signedInAfterSlowVerify(page: Page, login: (p: Page, phone: string) => Promise<void>): Promise<boolean> {
  await page.route("**/api/v1/auth/otp/verify", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await route.continue();
  });
  await login(page, uniquePhone("7"));
  await page.goto("/requests");
  await page.waitForLoadState("networkidle");
  return new URL(page.url()).pathname === "/requests";
}

test("A - a caller's goto right after login, with a slow verification", async ({ browser }) => {
  const legacy = await browser.newPage();
  const fixed = await browser.newPage();
  const legacySignedIn = await signedInAfterSlowVerify(legacy, legacyLogin);
  const fixedSignedIn = await signedInAfterSlowVerify(fixed, loginThroughUi);
  console.log(JSON.stringify({ probe: "A", legacySignedIn, fixedSignedIn }));
  expect(legacySignedIn).toBe(false);
  expect(fixedSignedIn).toBe(true);
});

async function directRequest(page: Page, request: import("@playwright/test").APIRequestContext, providerId: string, description: string): Promise<void> {
  await loginThroughUi(page, uniquePhone("7"));
  await fillAndSubmitRequest(page, { description });
  await expect(page.getByTestId("submitted-status")).toContainText("REQUESTED", { timeout: 20_000 });
  const requestId = (await page.getByTestId("submitted-request-id").innerText()).trim();
  const client = await readBrowserSession(page);
  const started = await request.post(`${API_URL}/api/v1/requests/${requestId}/match`, {
    headers: { Authorization: `Bearer ${client.accessToken}` },
    data: { mode: "DIRECT", providerId },
  });
  expect(started.status()).toBe(201);
}

test("B - the provider's inbox holds a newer request than the one under test", async ({ browser, request }) => {
  const provider = await setUpProvider(request, uniquePhone("6"), `Probe Pro ${Date.now().toString().slice(-4)}`);
  const ours = `Probe, la demande du test ${Date.now().toString()}.`;
  const foreign = `Probe, une demande etrangere ${Date.now().toString()}.`;
  const context = await browser.newContext({ permissions: ["geolocation"], geolocation: CASABLANCA });
  await directRequest(await context.newPage(), request, provider.profileId, ours);
  await directRequest(await context.newPage(), request, provider.profileId, foreign);

  const providerContext = await browser.newContext();
  await providerContext.addInitScript(...sessionInitScript(provider.session));
  const inbox = await providerContext.newPage();
  await inbox.goto("/provider/requests");
  const rows = inbox.getByTestId("provider-match-row");
  await expect(rows).toHaveCount(2, { timeout: 20_000 });

  const legacyPicksOurs = (await rows.first().innerText()).includes(ours);
  const fixedRows = await rows.filter({ hasText: ours }).count();
  console.log(JSON.stringify({ probe: "B", legacyPicksOurs, fixedRows }));
  expect(legacyPicksOurs).toBe(false);
  expect(fixedRows).toBe(1);
});
