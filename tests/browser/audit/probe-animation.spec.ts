import { writeFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { API_URL, CASABLANCA, fillAndSubmitRequest, loginThroughUi, readBrowserSession, setUpProvider, uniquePhone } from "../support/journeys";
test.use({ geolocation: CASABLANCA, permissions: ["geolocation"] });
test.setTimeout(300_000);
// Phase 11: is the 3.98:1 on a just-sent bubble the entry animation, or the settled colours?
test("contrast of a just-sent bubble: during vs after its entry animation", async ({ page, request }) => {
  const provider = await setUpProvider(request, uniquePhone("6"), `Anim Pro ${Date.now().toString().slice(-4)}`);
  await loginThroughUi(page, uniquePhone("7"));
  await expect(page).toHaveURL(/\/requests\/new$/, { timeout: 20_000 });
  await fillAndSubmitRequest(page);
  await expect(page.getByTestId("submitted-status")).toContainText("REQUESTED", { timeout: 20_000 });
  const requestId = (await page.getByTestId("submitted-request-id").innerText()).trim();
  const client = await readBrowserSession(page);
  await request.post(`${API_URL}/api/v1/requests/${requestId}/match`, { headers: { Authorization: `Bearer ${client.accessToken}` }, data: { mode: "DIRECT", providerId: provider.profileId } });
  await page.goto(`/requests/${requestId}/match`);
  await page.getByTestId("chat-with-provider-button").first().click({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/conversations\//, { timeout: 20_000 });
  const contrast = async (): Promise<string[]> => {
    const r = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
    return r.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(" ")}: ${(n.failureSummary ?? "").split("\n")[1]?.trim() ?? ""}`));
  };
  const running = async (): Promise<number> => page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
  await page.getByTestId("composer-input").fill("Bonjour");
  await page.getByTestId("send-button").click();
  await expect(page.getByTestId("message-item")).toHaveCount(1, { timeout: 10_000 });
  const during = { runningAnimations: await running(), violations: await contrast() };
  await page.evaluate(async () => { await Promise.all(document.getAnimations().map((a) => a.finished)); });
  const after = { runningAnimations: await running(), violations: await contrast() };
  const out = { during, after };
  console.log(JSON.stringify(out, null, 2));
  writeFileSync("../../docs/design/evidence/phase11/probe-animation.json", JSON.stringify(out, null, 2));
  await request.patch(`${API_URL}/api/v1/providers/me/availability`, { headers: { Authorization: `Bearer ${provider.session.accessToken}` }, data: { status: "OFFLINE" } });
});
