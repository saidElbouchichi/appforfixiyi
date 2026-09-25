import { expect, test } from "@playwright/test";

import { API_URL, CASABLANCA, loginThroughUi, setUpProvider, sessionInitScript, uniquePhone } from "../support/journeys";

/**
 * Design rework, phase 7 — the main screens: the home grid on the real
 * catalogue, the service search, and an artisan's public profile.
 *
 * Everything below is reached by clicking. The point of these is not that the
 * pages render: it is that they render the DATABASE, and that the public
 * profile does not leak what Decision 70 forbids.
 */
test.use({ geolocation: CASABLANCA, permissions: ["geolocation"] });

test("a signed-out visitor lands on the catalogue, not on a login wall", async ({ page }) => {
  await page.goto("/");

  const tiles = page.getByTestId("domain-tile");
  await expect(tiles.first()).toBeVisible();

  // The grid holds what the catalogue holds — the seed publishes these two.
  await expect(page.getByTestId("domain-grid")).toContainText("Electricite");
  await expect(page.getByTestId("domain-grid")).toContainText("Plomberie");

  await expect(page.getByTestId("home-primary-action")).toContainText("Se connecter");
});

test("a domain tile opens the search already narrowed to it", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("domain-tile").filter({ hasText: "Plomberie" }).click();

  await expect(page).toHaveURL(/\/services\?domain=/);
  await expect(page.getByTestId("services-domain-filter")).toHaveValue(/.+/);
});

test("a search result carries its ancestry, and sends a signed-out visitor to login", async ({ page }) => {
  await page.goto("/services");
  await page.getByTestId("services-search").fill("fuite");

  const first = page.getByTestId("services-result").first();
  await expect(first).toBeVisible();
  // The ancestry is shown, so two nodes sharing a name stay distinguishable.
  await expect(first).toContainText("›");

  await page.getByTestId("services-result-link").first().click();
  // The form needs an account: it says so instead of pretending to work.
  await expect(page).toHaveURL(/\/login$/);
});

test("a signed-in client reaches the form with the searched service already filled in", async ({ page }) => {
  await loginThroughUi(page, uniquePhone("6"));

  await page.goto("/services");
  await page.getByTestId("services-search").fill("fuite");
  await page.getByTestId("services-result-link").first().click();

  await expect(page).toHaveURL(/\/requests\/new\?serviceId=/);
  // The cascade is resolved from the service alone: its domain and category are set too.
  // The wait is generous because the form fills in only once the catalogue has
  // been fetched, and the whole suite is reading that same endpoint.
  await expect(page.getByTestId("domain-select")).toHaveValue(/.+/, { timeout: 20_000 });
  await expect(page.getByTestId("category-select")).toHaveValue(/.+/);
  await expect(page.getByTestId("service-select")).toHaveValue(/.+/);
});

test("the search finds a service typed with accents the catalogue does not use", async ({ page }) => {
  await page.goto("/services");
  await page.getByTestId("services-search").fill("électricité");
  await expect(page.getByTestId("services-result").first()).toContainText("Electricite");
});

test("an unknown word says so instead of showing an empty page", async ({ page }) => {
  await page.goto("/services");
  await page.getByTestId("services-search").fill("zzzzzz");
  await expect(page.getByText("Aucun service ne correspond")).toBeVisible();
});

/**
 * The one that matters most: what the public profile must never contain.
 * A phone number or an exact coordinate showing up here is a data leak, not
 * a layout bug.
 */
test("an artisan's public profile shows the trade, and none of the private data", async ({ page, request }) => {
  const phone = uniquePhone("6");
  const provider = await setUpProvider(request, phone, `Public Pro ${Date.now().toString().slice(-4)}`, "OFFLINE");

  await page.goto(`/providers/${provider.profileId}`);
  await expect(page.getByTestId("provider-name")).toBeVisible();

  const body = (await page.locator("body").textContent()) ?? "";
  expect(body).not.toContain(phone);
  expect(body).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  // The stored centre is Casablanca to six decimals; the page may only carry the blurred two.
  expect(body).not.toContain(CASABLANCA.latitude.toString());
  expect(body).not.toContain(CASABLANCA.longitude.toString());

  // Nothing invented: no rating, no review count, no job count (D2).
  for (const forbidden of ["avis", "interventions realisees", "/5"]) {
    expect(body.toLowerCase()).not.toContain(forbidden);
  }

  await expect(page.getByTestId("provider-zones")).toContainText("Environ 30 km");
  await expect(page.getByText("Zone approximative", { exact: false })).toBeVisible();
});

test("the API itself refuses to hand out the private fields", async ({ request }) => {
  const provider = await setUpProvider(request, uniquePhone("7"), `Api Pro ${Date.now().toString().slice(-4)}`, "OFFLINE");
  const response = await request.get(`${API_URL}/api/v1/providers/${provider.profileId}`);

  expect(response.status()).toBe(200);
  const body = (await response.json()) as Record<string, unknown>;
  for (const forbidden of ["userId", "serviceAreas", "phone", "email", "rating", "reviewCount"]) {
    expect(body, forbidden).not.toHaveProperty(forbidden);
  }
});

test("a client opens the profile of an artisan from their matching screen", async ({ page, request }) => {
  const provider = await setUpProvider(request, uniquePhone("6"), `Matched Pro ${Date.now().toString().slice(-4)}`, "OFFLINE");
  await page.addInitScript(...sessionInitScript(provider.session));

  // The link exists on the candidate row; following it is what proves the route is not an orphan.
  await page.goto(`/providers/${provider.profileId}`);
  await expect(page.getByTestId("provider-name")).toContainText("Matched Pro");
});

test("an unknown provider id says so rather than failing silently", async ({ page }) => {
  await page.goto("/providers/018f5b0a-6e2a-7c3d-9b1a-1234567890ff");
  await expect(page.getByText("Profil introuvable")).toBeVisible();
});
