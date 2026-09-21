import { expect, test } from "@playwright/test";

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

test.use({ permissions: ["geolocation"], geolocation: CASABLANCA });

/**
 * Real Phase 6 scenario: two browsers — a client and the provider the engine
 * dispatched — talk in real time, and the contact protection of
 * 01_SPEC_PRODUCT.md #27 holds in the actual UI, not only in API tests.
 *
 * The match is started in DIRECT mode on the provider this test created:
 * with AUTO mode, every earlier run leaves AVAILABLE providers on the seeded
 * service, and a batch of 3 would not reliably include this one. DIRECT is a
 * genuine Phase 5 mode (#14), not a test shortcut.
 */
test("a client and a provider chat live, and a phone number stays masked", async ({ page, browser, request }) => {
  const providerName = `Chat Pro ${Date.now().toString().slice(-4)}`;
  const provider = await setUpProvider(request, uniquePhone("6"), providerName);

  // ---------------------------------------------------------------- client
  await loginThroughUi(page, uniquePhone("7"));
  await expect(page).toHaveURL(/\/requests\/new$/);
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
  const conversationUrl = page.url();
  await expect(page.getByTestId("conversation-title")).toHaveText(providerName);
  await expect(page.getByTestId("contact-protected-banner")).toBeVisible();

  // -------------------------------------------------------------- provider
  const providerContext = await browser.newContext();
  await providerContext.addInitScript(...sessionInitScript(provider.session));
  const providerPage = await providerContext.newPage();
  await providerPage.goto("/provider/requests");
  await providerPage.getByTestId("chat-with-client-button").first().click();
  // Opened from the other side, it is the SAME conversation — never a duplicate.
  await expect(providerPage).toHaveURL(conversationUrl, { timeout: 20_000 });
  await expect(providerPage.getByTestId("connection-status")).toHaveText("En ligne", { timeout: 20_000 });
  await expect(page.getByTestId("connection-status")).toHaveText("En ligne", { timeout: 20_000 });

  // ---------------------------------------------------------- typing, live
  await providerPage.getByTestId("composer-input").pressSequentially("Bonjour");
  await expect(page.getByRole("status").filter({ hasText: `${providerName} ecrit` })).toBeVisible({ timeout: 10_000 });

  // ----------------------------------------- a phone number, masked, live
  await providerPage.getByTestId("composer-input").fill("Bonjour, appelez-moi au 06 12 34 56 78 ce soir");
  await providerPage.getByTestId("send-button").click();

  // The CLIENT receives it without reloading — pushed over the socket.
  const received = page.getByTestId("message-bubble").last();
  await expect(received).toContainText("Bonjour, appelez-moi au [•••] ce soir", { timeout: 10_000 });
  await expect(page.getByTestId("chat-log")).not.toContainText("56 78");

  // Their message ends their "typing" at once. The 1.5s deadline is shorter than every idle
  // timer (4s send, 6s display), so this passes only because the message itself clears it.
  await expect(page.getByRole("status").filter({ hasText: `${providerName} ecrit` })).toBeHidden({ timeout: 1_500 });

  // The PROVIDER is told the number was masked — never silently.
  await expect(providerPage.getByRole("note").filter({ hasText: "Coordonnees masquees" })).toBeVisible();

  // --------------------------------------------------------- read receipt
  // The client has the thread on screen, so it acknowledges "read"; the provider's tick turns to READ live.
  await expect(providerPage.getByTestId("message-bubble").last().locator("[data-status='READ']")).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: "screenshots/20-chat-client.png", animations: "disabled" });
  await providerPage.screenshot({ path: "screenshots/21-chat-provider.png", animations: "disabled" });

  // ------------------------------------------------------- reply, both ways
  await page.getByTestId("reply-button").last().click();
  await expect(page.getByTestId("reply-preview")).toBeVisible();
  await page.getByTestId("composer-input").fill("Merci, je prefere echanger ici en attendant le devis.");
  await page.getByTestId("composer-input").press("Enter");

  const reply = providerPage.getByTestId("message-bubble").last();
  await expect(reply).toContainText("je prefere echanger ici", { timeout: 10_000 });
  await expect(reply).toContainText("Bonjour, appelez-moi au [•••] ce soir");
  await providerPage.screenshot({ path: "screenshots/22-chat-reply.png", animations: "disabled" });

  // ---------------------------------------- nothing survives a reload
  // The socket is never the source of truth: after a full reload the thread comes back from the database.
  await page.reload();
  await expect(page.getByTestId("message-bubble")).toHaveCount(2, { timeout: 20_000 });
  await expect(page.getByTestId("chat-log")).not.toContainText("56 78");

  console.log(`Chat ${conversationUrl}: live delivery, typing, masking, read receipt and reply verified in two browsers.`);
  await providerContext.close();
});
