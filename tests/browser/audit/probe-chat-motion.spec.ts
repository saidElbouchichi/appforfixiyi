import { writeFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { API_URL, CASABLANCA, fillAndSubmitRequest, loginThroughUi, readBrowserSession, setUpProvider, uniquePhone } from "../support/journeys";

/**
 * Phase 12 audit: which chat messages play an entry animation, and when.
 * A message that ARRIVES (sent or pushed) is news; a message that was already
 * there when the thread opened is history. Output: evidence/phase12/chat-motion-<label>.json.
 */
const OUT = "../../docs/design/evidence/phase12";
const LABEL = process.env.AUDIT_LABEL ?? "avant";
test.use({ geolocation: CASABLANCA, permissions: ["geolocation"] });
test.setTimeout(240_000);

const entering = (page: Page): Promise<number> =>
  page.evaluate(
    () => document.getAnimations().filter((a) => ((a.effect as KeyframeEffect).target as Element | null)?.closest("[data-testid=message-item]")).length,
  );

test("entry animations on a thread: history versus arrivals", async ({ page, request }) => {
  const provider = await setUpProvider(request, uniquePhone("6"), `Motion Chat ${Date.now().toString().slice(-4)}`);
  await loginThroughUi(page, uniquePhone("7"));
  await fillAndSubmitRequest(page);
  await expect(page.getByTestId("submitted-status")).toContainText("REQUESTED", { timeout: 20_000 });
  const requestId = (await page.getByTestId("submitted-request-id").innerText()).trim();
  const client = await readBrowserSession(page);
  await request.post(`${API_URL}/api/v1/requests/${requestId}/match`, {
    headers: { Authorization: `Bearer ${client.accessToken}` },
    data: { mode: "DIRECT", providerId: provider.profileId },
  });
  await page.goto(`/requests/${requestId}/match`);
  await page.getByTestId("chat-with-provider-button").first().click({ timeout: 20_000 });
  await page.waitForURL(/\/conversations\/[0-9a-f-]+$/);

  const sent: number[] = [];
  for (const text of ["Un", "Deux", "Trois", "Quatre"]) {
    await page.getByTestId("composer-input").fill(text);
    await page.getByTestId("send-button").click();
    await expect(page.getByTestId("message-item").filter({ hasText: text })).toHaveCount(1, { timeout: 10_000 });
    sent.push(await entering(page));
  }

  await page.reload();
  await expect(page.getByTestId("message-item")).toHaveCount(4, { timeout: 20_000 });
  const onReopen = await entering(page);

  await page.getByTestId("composer-input").fill("Cinq");
  await page.getByTestId("send-button").click();
  await expect(page.getByTestId("message-item")).toHaveCount(5, { timeout: 10_000 });
  const afterReopenSend = await page.evaluate(() =>
    document
      .getAnimations()
      .map((a) => ((a.effect as KeyframeEffect).target as Element | null)?.closest("[data-testid=message-item]")?.textContent?.slice(0, 12))
      .filter(Boolean),
  );

  const result = { sentWhileOpen: sent, messagesOnReopen: 4, animatedOnReopen: onReopen, animatedAfterSendingOneMore: afterReopenSend };
  writeFileSync(`${OUT}/chat-motion-${LABEL}.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
});
