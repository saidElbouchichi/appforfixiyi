/** @jsxImportSource react */
import { writeFileSync } from "node:fs";

import { Badge, BottomSheet, Button, CommandPalette, Modal, ProgressBar, Skeleton, Spinner } from "@fixiyi/ui";
import { expect, test, type Page } from "@playwright/test";

import { API_URL, CASABLANCA, fillAndSubmitRequest, loginThroughUi, readBrowserSession, sessionInitScript, setUpProvider, uniquePhone } from "../support/journeys";
import { renderUi } from "../support/ui-harness";

/**
 * Phase 12 audit harness — NOT the regression suite. Lists every CSS animation
 * and transition the browser is actually running (document.getAnimations()),
 * on the real routes and on the component bench, with normal and reduced
 * motion. Output: docs/design/evidence/phase12/motion-<label>.json.
 */
const OUT = "../../docs/design/evidence/phase12";
const LABEL = process.env.AUDIT_LABEL ?? "avant";
const noop = (): void => undefined;

test.use({ geolocation: CASABLANCA, permissions: ["geolocation"] });
test.setTimeout(600_000);

interface Motion {
  kind: string;
  name: string;
  target: string;
  duration: number;
  delay: number;
  iterations: number | null;
  activeDuration: number | null;
  easing: string;
  properties: string[];
}

/** Every animation the document holds — running, pending, or finished but still filling. */
async function motions(page: Page): Promise<Motion[]> {
  return page.evaluate(() => {
    const describe = (node: Element | null): string => {
      if (!node) return "?";
      const testId = node.getAttribute("data-testid");
      const classes = [...node.classList].slice(0, 3).join(".");
      return `${node.tagName.toLowerCase()}${classes ? `.${classes}` : ""}${testId ? `[${testId}]` : ""}`;
    };
    // Infinity is not JSON: keep it readable in the evidence file.
    const finite = (n: number | string | undefined): number | null => (typeof n === "number" && Number.isFinite(n) ? n : null);
    return document.getAnimations().map((animation) => {
      const effect = animation.effect as KeyframeEffect;
      const timing = effect.getComputedTiming();
      const css = animation as Animation & { animationName?: string; transitionProperty?: string };
      const pseudo = effect.pseudoElement ?? "";
      return {
        kind: animation.constructor.name,
        name: css.animationName ?? css.transitionProperty ?? "script",
        target: describe(effect.target as Element | null) + pseudo,
        duration: Number(timing.duration),
        delay: timing.delay ?? 0,
        iterations: finite(timing.iterations),
        activeDuration: finite(timing.activeDuration),
        easing: effect.getTiming().easing ?? "",
        properties: [...new Set(effect.getKeyframes().flatMap((frame) => Object.keys(frame)))].filter(
          (key) => !["offset", "computedOffset", "easing", "composite"].includes(key),
        ),
      };
    });
  });
}

type Scene = (page: Page) => Promise<void>;

async function measure(page: Page, scenes: Record<string, Scene>): Promise<Record<string, { normal: Motion[]; reduce: Motion[] }>> {
  const result: Record<string, { normal: Motion[]; reduce: Motion[] }> = {};
  for (const [name, scene] of Object.entries(scenes)) {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await scene(page);
    const normal = await motions(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await scene(page);
    const reduce = await motions(page);
    result[name] = { normal, reduce };
  }
  return result;
}

const route =
  (path: string, ready: (page: Page) => Promise<void>): Scene =>
  async (page) => {
    await page.goto(path);
    await ready(page);
  };
const h1 = async (page: Page): Promise<void> => {
  await expect(page.locator("h1")).toHaveCount(1, { timeout: 20_000 });
};

const bench: Record<string, Scene> = {
  modal: (page) => renderUi(page, <Modal open title="Confirmer" onClose={noop}><p>Texte</p></Modal>),
  sheet: (page) => renderUi(page, <BottomSheet open title="Filtrer" onClose={noop}><p>Texte</p></BottomSheet>),
  palette: (page) => renderUi(page, <CommandPalette open onClose={noop} commands={[{ id: "a", label: "Mes demandes", onRun: noop }]} />, { width: 1024 }),
  menuList: (page) => renderUi(page, <ul className="fx-menu__list" role="menu"><li role="menuitem">Modifier</li></ul>),
  toast: (page) => renderUi(page, <div className="fx-toast fx-toast--info" role="status">Demande envoyee</div>),
  loading: (page) => renderUi(page, <div><Spinner /><Skeleton lines={2} /><ProgressBar label="Envoi" /></div>),
  urgent: (page) => renderUi(page, <div><Badge variant="warning" pulse>Urgent</Badge><Button variant="pulse">Demander</Button></div>),
  // The instrument check: an infinite animation on an element WITHOUT an fx- class.
  // It escapes both reduced-motion rules, so the probe must report it in both modes.
  control: (page) => renderUi(page, <div style={{ animation: "fx-spin 2s linear infinite" }} id="control">x</div>),
};

test("motion on the bench and on the real routes", async ({ page, browser, request }) => {
  const benchResult = await measure(page, bench);

  // Real sessions: a client with a request, a DIRECT match, a conversation with a message.
  const provider = await setUpProvider(request, uniquePhone("6"), `Motion Pro ${Date.now().toString().slice(-4)}`);
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
  const conversation = new URL(page.url()).pathname;
  await page.getByTestId("composer-input").fill("Bonjour");
  await page.getByTestId("send-button").click();
  await expect(page.getByTestId("message-item")).toHaveCount(1, { timeout: 10_000 });

  const clientRoutes: Record<string, Scene> = {
    "/": route("/", h1),
    "/services": route("/services?q=panne", h1),
    "/requests/new": route("/requests/new", h1),
    "/requests": route("/requests", h1),
    "/requests/:id/match": route(`/requests/${requestId}/match`, h1),
    "/conversations": route("/conversations", h1),
    "/conversations/:id": route(conversation, async (p) => {
      await expect(p.getByTestId("message-item")).toHaveCount(1, { timeout: 20_000 });
    }),
    "/profile": route("/profile", h1),
    "/providers/:id": route(`/providers/${provider.profileId}`, h1),
    "hover: bouton primaire": async (p) => {
      await p.goto("/requests/new");
      await h1(p);
      await p.getByTestId("submit-request-button").hover();
    },
  };
  const routeResult = await measure(page, clientRoutes);

  const providerContext = await browser.newContext();
  await providerContext.addInitScript(...sessionInitScript(provider.session));
  const providerPage = await providerContext.newPage();
  const providerResult = await measure(providerPage, {
    "/provider/requests": route("/provider/requests", async (p) => {
      await expect(p.getByTestId("provider-match-row").first()).toBeVisible({ timeout: 20_000 });
    }),
  });

  const publicPage = await browser.newPage();
  const loginResult = await measure(publicPage, { "/login": route("/login", h1) });

  writeFileSync(`${OUT}/motion-${LABEL}.json`, JSON.stringify({ bench: benchResult, routes: { ...routeResult, ...providerResult, ...loginResult } }, null, 2));
  // The instrument must see the control in both modes, or its zeros mean nothing.
  expect(benchResult.control?.normal.length).toBeGreaterThan(0);
  expect(benchResult.control?.reduce.length).toBeGreaterThan(0);
});
