import { writeFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { API_URL, CASABLANCA, fillAndSubmitRequest, loginThroughUi, readBrowserSession, setUpProvider, uniquePhone } from "../support/journeys";

// Phase 11: detail of the three findings on a conversation holding one message.
test.use({ geolocation: CASABLANCA, permissions: ["geolocation"] });
test.setTimeout(300_000);

test("conversation findings, in detail", async ({ page, request }) => {
  const provider = await setUpProvider(request, uniquePhone("6"), `Probe Pro ${Date.now().toString().slice(-4)}`);
  await loginThroughUi(page, uniquePhone("7"));
  await expect(page).toHaveURL(/\/requests\/new$/, { timeout: 20_000 });
  await fillAndSubmitRequest(page);
  await expect(page.getByTestId("submitted-status")).toContainText("REQUESTED", { timeout: 20_000 });
  const requestId = (await page.getByTestId("submitted-request-id").innerText()).trim();
  const client = await readBrowserSession(page);
  await request.post(`${API_URL}/api/v1/requests/${requestId}/match`, { headers: { Authorization: `Bearer ${client.accessToken}` }, data: { mode: "DIRECT", providerId: provider.profileId } });
  await page.goto(`/requests/${requestId}/match`);
  await page.getByTestId("chat-with-provider-button").first().click({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/conversations\/[0-9a-f-]+$/, { timeout: 20_000 });
  const path = new URL(page.url()).pathname;

  const out: Record<string, unknown> = {};
  const axeDetail = async (): Promise<unknown> => {
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    return r.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => ({ target: n.target, html: n.html.slice(0, 300), why: n.failureSummary })) }));
  };
  const widest = async (): Promise<unknown> => page.evaluate(() => {
    const vw = window.innerWidth;
    const list: string[] = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1) list.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")} right=${Math.round(r.right).toString()} w=${Math.round(r.width).toString()}`);
    }
    return { scrollWidth: document.documentElement.scrollWidth, vw, list: list.slice(0, 15) };
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(path, { waitUntil: "networkidle" });
  out.emptyAxe = await axeDetail();
  await page.setViewportSize({ width: 320, height: 800 });
  out.empty320 = await widest();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId("composer-input").fill("Bonjour, message de l'audit");
  await page.getByTestId("send-button").click();
  await expect(page.getByTestId("message-item")).toHaveCount(1, { timeout: 10_000 });
  await page.waitForLoadState("networkidle");
  out.withMessageAxe = await axeDetail();
  await page.screenshot({ path: `../../docs/design/evidence/phase11/${process.env.SHOT ?? "AVANT"}-conversation-1440.png` });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(path, { waitUntil: "networkidle" });
  await expect(page.getByTestId("message-item")).toHaveCount(1, { timeout: 10_000 });
  out.withMessage320 = await widest();
  for (const width of [360, 768]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.getByTestId("message-item")).toHaveCount(1, { timeout: 10_000 });
    out[`withMessage${width.toString()}`] = await widest();
  }
  await page.setViewportSize({ width: 320, height: 800 });
  await page.screenshot({ path: `../../docs/design/evidence/phase11/${process.env.SHOT ?? "AVANT"}-conversation-320.png`, fullPage: true });

  await request.patch(`${API_URL}/api/v1/providers/me/availability`, { headers: { Authorization: `Bearer ${provider.session.accessToken}` }, data: { status: "OFFLINE" } });
  writeFileSync("../../docs/design/evidence/phase11/probe-conversation.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
});
