import { type Page } from "@playwright/test";

import { API_URL, CASABLANCA, fillAndSubmitRequest, loginThroughUi, readBrowserSession, setUpProvider, uniquePhone } from "../support/journeys";
import { expect, test } from "../support/test";

/**
 * Design phase 12 — motion, read in the browser rather than in the source:
 * `document.getAnimations()` lists what actually runs. An animation is kept
 * only when it tells something (content arrives, a state changes, a wait);
 * the measured defects were motion that replayed on content already there.
 */
test.use({ permissions: ["geolocation"], geolocation: CASABLANCA });

/** Only what waits is allowed to move forever (WCAG 2.2.2 allows it while loading). */
const WAITING = ".fx-spinner, .fx-skeleton, .fx-progress__bar, .fx-typing__dots > span";

interface Running {
  target: string;
  activeDuration: number | null;
  waiting: boolean;
}

async function running(page: Page, within?: string): Promise<Running[]> {
  return page.evaluate(
    ({ scope, waiting }) =>
      document
        .getAnimations()
        .map((animation) => {
          const effect = animation.effect as KeyframeEffect;
          const target = effect.target as Element | null;
          const active = Number(effect.getComputedTiming().activeDuration);
          return {
            element: target,
            target: `${target?.tagName.toLowerCase() ?? "?"}.${[...(target?.classList ?? [])].join(".")}`,
            activeDuration: Number.isFinite(active) ? active : null,
            waiting: target?.matches(waiting) ?? false,
          };
        })
        .filter((motion) => scope === undefined || motion.element?.closest(scope))
        .map(({ target, activeDuration, waiting: isWaiting }) => ({ target, activeDuration, waiting: isWaiting })),
    { scope: within, waiting: WAITING },
  );
}

const h1 = async (page: Page): Promise<void> => {
  await expect(page.locator("h1")).toHaveCount(1, { timeout: 20_000 });
};

async function conversationWithMessages(page: Page, request: import("@playwright/test").APIRequestContext): Promise<string> {
  const provider = await setUpProvider(request, uniquePhone("6"), `Motion Pro ${Date.now().toString().slice(-4)}`);
  await loginThroughUi(page, uniquePhone("7"));
  await fillAndSubmitRequest(page);
  await expect(page.getByTestId("submitted-status")).toContainText("REQUESTED", { timeout: 20_000 });
  const requestId = (await page.getByTestId("submitted-request-id").innerText()).trim();
  const client = await readBrowserSession(page);
  const started = await request.post(`${API_URL}/api/v1/requests/${requestId}/match`, {
    headers: { Authorization: `Bearer ${client.accessToken}` },
    data: { mode: "DIRECT", providerId: provider.profileId },
  });
  expect(started.status()).toBe(201);
  // Other specs leave AVAILABLE providers behind: DIRECT keeps this one's the only row.
  await request.patch(`${API_URL}/api/v1/providers/me/availability`, {
    headers: { Authorization: `Bearer ${provider.session.accessToken}` },
    data: { status: "OFFLINE" },
  });
  await page.goto(`/requests/${requestId}/match`);
  await page.getByTestId("chat-with-provider-button").first().click({ timeout: 20_000 });
  await page.waitForURL(/\/conversations\/[0-9a-f-]+$/, { timeout: 20_000 });
  return page.url();
}

async function send(page: Page, text: string): Promise<void> {
  await page.getByTestId("composer-input").fill(text);
  await page.getByTestId("send-button").click();
  await expect(page.getByTestId("message-item").filter({ hasText: text })).toHaveCount(1, { timeout: 10_000 });
}

test("a chat thread animates the messages that arrive, never the history it opens on", async ({ page, request }) => {
  const conversation = await conversationWithMessages(page, request);
  await send(page, "Premier");
  await send(page, "Second");

  await page.goto(conversation);
  await expect(page.getByTestId("message-item")).toHaveCount(2, { timeout: 20_000 });
  expect(await running(page, "[data-testid=message-item]"), "history replayed as arrivals").toEqual([]);

  await send(page, "Troisieme");
  const entering = await page.evaluate(() =>
    document
      .getAnimations()
      .map((animation) => ((animation.effect as KeyframeEffect).target as Element | null)?.closest("[data-testid=message-item]")?.getAttribute("data-seq"))
      .filter(Boolean),
  );
  const newest = await page.getByTestId("message-item").last().getAttribute("data-seq");
  expect(entering, "only the message just sent enters").toEqual([newest]);
});

test("a list enters when it arrives, and stays still when it is already there", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("domain-grid")).toBeVisible({ timeout: 20_000 });
  expect((await running(page, "[data-testid=domain-grid]")).length, "the first load arrives").toBeGreaterThan(0);

  // A client-side return, with the catalogue cached: nothing arrives.
  await page.goto("/services?q=panne");
  await h1(page);
  await page.locator("header a[href='/']").first().click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByTestId("domain-grid")).toBeVisible();
  expect(await running(page, "[data-testid=domain-grid]"), "a cached list replayed its entry").toEqual([]);

  // The login page is a destination, not an arrival: its card does not slide in.
  await page.goto("/login");
  await h1(page);
  expect(await running(page, "main"), "the login card decorates its own page").toEqual([]);
});

test("with reduced motion nothing moves; without it, only a wait may move for long", async ({ page, request }) => {
  const conversation = await conversationWithMessages(page, request);
  await send(page, "Bonjour");
  const routes = ["/", "/services?q=panne", "/requests/new", "/requests", "/conversations", "/profile", new URL(conversation).pathname];

  for (const reducedMotion of ["reduce", "no-preference"] as const) {
    await page.emulateMedia({ reducedMotion });
    for (const route of routes) {
      await page.goto(route);
      await h1(page);
      const motions = await running(page);
      if (reducedMotion === "reduce") {
        // WCAG 2.3.3 and the user's own setting: at most a 0.01ms collapse to the final frame.
        const moving = motions.filter((motion) => motion.activeDuration === null || motion.activeDuration > 1);
        expect(moving, `${route} moves under reduced motion`).toEqual([]);
      } else {
        // WCAG 2.2.2: past 5s, moving content must be a wait, or it needs a pause control.
        const long = motions.filter((motion) => (motion.activeDuration === null || motion.activeDuration > 5_000) && !motion.waiting);
        expect(long, `${route} moves for more than 5s`).toEqual([]);
      }
    }
  }
});
