import { expect, test, type Page } from "@playwright/test";

/**
 * Regression cover for the bug found by the Phase 0-5 inspection: the client
 * stored a `refreshToken` and never used it, so every authenticated screen
 * broke 15 minutes after login (`JWT_ACCESS_TTL`) with "Invalid or expired
 * access token", and the dead session sat in localStorage with no way out.
 *
 * Both tests drive the real stack (apps/web on :3000, apps/api on :4000) and
 * simulate the expiry by replacing the stored access token — the same state
 * the clock produces after 15 minutes, without waiting 15 minutes.
 */
const STORAGE_KEY = "fixiyi-web-auth";
const EXPIRED_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJleHBpcmVkIiwiZXhwIjoxfQ.notavalidsignature";

interface PersistedAuth {
  state: { accessToken: string; refreshToken: string };
}

async function loginWithOtp(page: Page): Promise<void> {
  const phone = `+2126${Date.now().toString().slice(-8)}`;
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
  await expect(page).toHaveURL(/\/requests\/new$/);
}

async function readAuth(page: Page): Promise<PersistedAuth> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
  if (!raw) {
    throw new Error("no persisted auth in localStorage");
  }
  return JSON.parse(raw) as PersistedAuth;
}

async function expireStoredTokens(page: Page, options: { alsoBreakRefresh: boolean }): Promise<void> {
  await page.evaluate(
    ({ key, expired, alsoBreakRefresh }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) throw new Error("no persisted auth");
      const parsed = JSON.parse(raw) as { state: { accessToken: string; refreshToken: string } };
      parsed.state.accessToken = expired;
      if (alsoBreakRefresh) {
        parsed.state.refreshToken = expired;
      }
      window.localStorage.setItem(key, JSON.stringify(parsed));
    },
    { key: STORAGE_KEY, expired: EXPIRED_TOKEN, alsoBreakRefresh: options.alsoBreakRefresh },
  );
}

test("an expired access token is refreshed transparently and the screen still works", async ({ page }) => {
  const refreshCalls: number[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/auth/refresh")) {
      refreshCalls.push(response.status());
    }
  });

  await loginWithOtp(page);
  const before = await readAuth(page);
  expect(before.state.refreshToken, "a refresh token is stored at login").toBeTruthy();

  await expireStoredTokens(page, { alsoBreakRefresh: false });
  await page.goto("/requests/new");

  // The screen loads its catalog, which is an authenticated call — so it only
  // fills if the 401 was recovered from.
  const domainSelect = page.getByTestId("domain-select");
  await expect(domainSelect.locator("option")).not.toHaveCount(1, { timeout: 20_000 });

  // The failure mode is invisible without this: the old build showed the raw
  // API error on the page instead.
  await expect(page.getByText("Invalid or expired access token")).toHaveCount(0);
  await expect(page).toHaveURL(/\/requests\/new$/);

  expect(refreshCalls, "exactly one refresh, and it succeeded").toEqual([201]);

  const after = await readAuth(page);
  expect(after.state.accessToken, "the rotated access token replaced the expired one").not.toBe(EXPIRED_TOKEN);
  expect(after.state.refreshToken, "the refresh token rotated too").not.toBe(before.state.refreshToken);
});

test("a session whose refresh token is dead too is cleared and sent back to login", async ({ page }) => {
  await loginWithOtp(page);
  await expireStoredTokens(page, { alsoBreakRefresh: true });

  await page.goto("/requests/new");

  // No dead end: the user is returned to /login rather than left staring at an
  // error on a screen that can never load.
  await expect(page).toHaveURL(/\/login$/, { timeout: 20_000 });

  const raw = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
  const persisted = raw === null ? null : (JSON.parse(raw) as PersistedAuth);
  expect(persisted?.state.accessToken ?? null, "the dead session is not left behind in localStorage").toBeNull();
});
