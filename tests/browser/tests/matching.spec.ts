import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

/** Casablanca — the geolocation Playwright injects, and where the provider's service area is centred. */
const CASABLANCA = { latitude: 33.573109, longitude: -7.589843 };

/** The seeded chain used by the client form below (`CatalogSeedService`). */
const SERVICE_NAME = "Panne electrique";

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
  await page.screenshot({ path: "screenshots/10-request-submitted.png" });

  await page.getByTestId("go-to-match-button").click();
  await expect(page).toHaveURL(/\/match$/);

  await page.getByTestId("start-match-button").click();
  await expect(page.getByTestId("match-status")).toContainText("ACTIVE", { timeout: 20_000 });
  await expect(page.getByTestId("candidate-list")).toContainText(providerName, { timeout: 20_000 });
  await page.screenshot({ path: "screenshots/11-match-candidates.png" });

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
  await providerContext.addInitScript((session) => {
    window.localStorage.setItem("fixiyi-web-auth", JSON.stringify({ state: session, version: 0 }));
  }, provider.session);

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
  await providerPage.screenshot({ path: "screenshots/12-provider-inbox.png" });

  await providerPage.getByTestId("decline-button").first().click();
  await expect(providerPage.getByTestId("provider-match-row")).toHaveCount(0, { timeout: 20_000 });
  await providerPage.screenshot({ path: "screenshots/13-provider-declined.png" });

  console.log(`Provider ${providerName} (${provider.profileId}) was dispatched to and declined through the UI.`);
  await providerContext.close();
});

async function loginThroughUi(page: Page, phone: string): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("phone-input").fill(phone);
  await page.getByTestId("request-otp-button").click();

  const devCodeText = await page.getByTestId("dev-code").innerText();
  const code = /\d{6}/.exec(devCodeText)?.[0];
  if (!code) {
    throw new Error(`Could not read a 6-digit dev OTP code from: "${devCodeText}"`);
  }
  await page.getByTestId("otp-input").fill(code);
  await page.getByTestId("verify-otp-button").click();
}

async function fillAndSubmitRequest(page: Page): Promise<void> {
  const domainSelect = page.getByTestId("domain-select");
  await expect(domainSelect.locator("option")).not.toHaveCount(1, { timeout: 15_000 });

  await domainSelect.selectOption({ label: "Electricite" });
  await page.getByTestId("category-select").selectOption({ label: SERVICE_NAME });
  await page.getByTestId("service-select").selectOption({ label: SERVICE_NAME });
  await page.getByTestId("intervention-type-select").selectOption({ label: "Diagnostic / reparation" });
  await page.getByTestId("complexity-select").selectOption({ label: "Simple" });

  await page.getByTestId("description-input").fill("Prise de courant ne fonctionne plus depuis hier.");
  await page.getByTestId("address-input").fill("12 rue des Fleurs, Casablanca");
  await page.getByTestId("use-my-location-button").click();
  await expect(page.getByTestId("coordinates-display")).toContainText("33.573", { timeout: 10_000 });

  await page.getByTestId("submit-request-button").click();
}

/**
 * Full provider onboarding through the real API: OTP login, PROVIDER role,
 * profile, service + service area, and finally AVAILABLE — every hard
 * eligibility filter of the engine.
 */
interface ProviderSession {
  accessToken: string;
  refreshToken: string;
  user: unknown;
}

async function setUpProvider(
  request: APIRequestContext,
  phone: string,
  displayName: string,
): Promise<{ profileId: string; availabilityStatus: string; session: ProviderSession }> {
  const otp = await request.post(`${API_URL}/api/v1/auth/otp/request`, { data: { phone } });
  const { devCode } = (await otp.json()) as { devCode?: string };
  if (!devCode) {
    throw new Error("The API did not return a dev OTP code — is SMS_PROVIDER=dev?");
  }

  const verified = await request.post(`${API_URL}/api/v1/auth/otp/verify`, { data: { phone, code: devCode } });
  const session = (await verified.json()) as { accessToken: string; refreshToken: string };

  const auth = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` });

  const twentyYearsAgo = new Date();
  twentyYearsAgo.setUTCFullYear(twentyYearsAgo.getUTCFullYear() - 20);
  await request.patch(`${API_URL}/api/v1/auth/me`, {
    headers: auth(session.accessToken),
    data: { dateOfBirth: twentyYearsAgo.toISOString() },
  });
  await request.post(`${API_URL}/api/v1/auth/roles/provider`, { headers: auth(session.accessToken) });

  const refreshed = await request.post(`${API_URL}/api/v1/auth/refresh`, { data: { refreshToken: session.refreshToken } });
  const { accessToken } = (await refreshed.json()) as { accessToken: string };

  const created = await request.post(`${API_URL}/api/v1/providers/me`, {
    headers: auth(accessToken),
    data: { type: "TECHNICIEN", displayName, experienceYears: 8 },
  });
  expect(created.status()).toBe(201);
  const profile = (await created.json()) as { id: string };

  const serviceId = await findSeededServiceId(request);
  const updated = await request.patch(`${API_URL}/api/v1/providers/me`, {
    headers: auth(accessToken),
    data: {
      serviceIds: [serviceId],
      serviceAreas: [{ center: { type: "Point", coordinates: [CASABLANCA.longitude, CASABLANCA.latitude] }, radiusKm: 30 }],
    },
  });
  expect(updated.status()).toBe(200);

  const availability = await request.patch(`${API_URL}/api/v1/providers/me/availability`, {
    headers: auth(accessToken),
    data: { status: "AVAILABLE" },
  });
  expect(availability.status()).toBe(200);
  const finalProfile = (await availability.json()) as { availabilityStatus: string };

  // Re-read the user so the injected session carries the PROVIDER role the
  // provider screen checks for.
  const me = await request.get(`${API_URL}/api/v1/auth/me`, { headers: auth(accessToken) });
  const user: unknown = await me.json();

  return {
    profileId: profile.id,
    availabilityStatus: finalProfile.availabilityStatus,
    session: { accessToken, refreshToken: session.refreshToken, user },
  };
}

interface CatalogNode {
  id: string;
  name: string;
  children: CatalogNode[];
}

async function findSeededServiceId(request: APIRequestContext): Promise<string> {
  const response = await request.get(`${API_URL}/api/v1/catalog/tree`);
  const tree = (await response.json()) as CatalogNode[];

  const electricite = tree.find((node) => node.name === "Electricite");
  const category = electricite?.children.find((node) => node.name === SERVICE_NAME);
  const service = category?.children.find((node) => node.name === SERVICE_NAME);
  if (!service) {
    throw new Error(`Seed inconsistency: service "${SERVICE_NAME}" not found in the catalog tree`);
  }
  return service.id;
}
