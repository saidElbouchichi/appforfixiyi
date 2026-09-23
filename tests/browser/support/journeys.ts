import { expect, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Shared, REAL journeys for the browser specs (extracted from
 * matching.spec.ts once a second spec needed them). Everything goes through
 * the running stack — the UI where Fixiyi has a screen, the API where it
 * does not yet (provider onboarding has endpoints since Phase 3, no screens).
 */

export const API_URL = process.env.API_URL ?? "http://localhost:4000";

/** Casablanca — the geolocation Playwright injects, and where providers' service areas are centred. */
export const CASABLANCA = { latitude: 33.573109, longitude: -7.589843 };

/** The seeded chain used by the client form (`CatalogSeedService`). */
export const SERVICE_NAME = "Panne electrique";

/** A fresh, valid Moroccan mobile per call. */
export function uniquePhone(prefix: "6" | "7"): string {
  return `+212${prefix}${Date.now().toString().slice(-8)}`;
}

export async function loginThroughUi(page: Page, phone: string): Promise<void> {
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

export async function fillAndSubmitRequest(page: Page): Promise<void> {
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

export interface ProviderSession {
  accessToken: string;
  refreshToken: string;
  user: unknown;
}

export interface OnboardedProvider {
  profileId: string;
  availabilityStatus: string;
  session: ProviderSession;
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

/**
 * Full provider onboarding through the real API: OTP login, PROVIDER role,
 * profile, service + service area, and finally AVAILABLE — every hard
 * eligibility filter of the matching engine.
 */
/**
 * `availability` defaults to AVAILABLE — the only status the dispatch picks up
 * (`DISPATCHABLE_STATUSES`). A spec that only needs a provider to LOOK at, not
 * to be matched, passes "OFFLINE": every AVAILABLE provider in Casablanca
 * competes for the bounded dispatch batch of the matching spec, and enough of
 * them push its own provider out of the batch.
 */
export async function setUpProvider(
  request: APIRequestContext,
  phone: string,
  displayName: string,
  initialStatus: "AVAILABLE" | "OFFLINE" = "AVAILABLE",
): Promise<OnboardedProvider> {
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
  await request.patch(`${API_URL}/api/v1/auth/me`, { headers: auth(session.accessToken), data: { dateOfBirth: twentyYearsAgo.toISOString() } });
  await request.post(`${API_URL}/api/v1/auth/roles/provider`, { headers: auth(session.accessToken) });

  // The role change rotates into a new token pair; keep BOTH, the rotated refresh token is the only valid one.
  const refreshed = await request.post(`${API_URL}/api/v1/auth/refresh`, { data: { refreshToken: session.refreshToken } });
  const tokens = (await refreshed.json()) as { accessToken: string; refreshToken: string };

  const created = await request.post(`${API_URL}/api/v1/providers/me`, {
    headers: auth(tokens.accessToken),
    data: { type: "TECHNICIEN", displayName, experienceYears: 8 },
  });
  expect(created.status()).toBe(201);
  const profile = (await created.json()) as { id: string };

  const updated = await request.patch(`${API_URL}/api/v1/providers/me`, {
    headers: auth(tokens.accessToken),
    data: {
      serviceIds: [await findSeededServiceId(request)],
      serviceAreas: [{ center: { type: "Point", coordinates: [CASABLANCA.longitude, CASABLANCA.latitude] }, radiusKm: 30 }],
    },
  });
  expect(updated.status()).toBe(200);

  const availability = await request.patch(`${API_URL}/api/v1/providers/me/availability`, {
    headers: auth(tokens.accessToken),
    data: { status: initialStatus },
  });
  expect(availability.status()).toBe(200);
  const finalProfile = (await availability.json()) as { availabilityStatus: string };

  // Re-read the user so an injected session carries the PROVIDER role the provider screen checks for.
  const me = await request.get(`${API_URL}/api/v1/auth/me`, { headers: auth(tokens.accessToken) });
  return {
    profileId: profile.id,
    availabilityStatus: finalProfile.availabilityStatus,
    session: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: await me.json() },
  };
}

/** The web app's persisted session, as the browser holds it. */
export async function readBrowserSession(page: Page): Promise<{ accessToken: string; user: { id: string } }> {
  const raw = await page.evaluate(() => window.localStorage.getItem("fixiyi-web-auth"));
  if (!raw) throw new Error("no persisted session in the browser");
  return (JSON.parse(raw) as { state: { accessToken: string; user: { id: string } } }).state;
}

/**
 * Injects a session issued by the real API instead of re-typing it through
 * the login form: the provider's OTP was just used during API onboarding,
 * and a second request for the same number is refused for 60s — a real
 * anti-abuse rule (Decision 17), not something to work around by sleeping.
 */
export function sessionInitScript(session: ProviderSession): [(value: ProviderSession) => void, ProviderSession] {
  return [
    (value) => {
      window.localStorage.setItem("fixiyi-web-auth", JSON.stringify({ state: value, version: 0 }));
    },
    session,
  ];
}
