import { expect, test } from "@playwright/test";

/**
 * Merge-gate journey for sysnapse/rakazo (ticket TICKET-20261117-03).
 *
 * Business claim under test: a brand-new account is placed in a working chat with its first
 * bot, and a bot it creates through the UI is stored server-side and still resolves by URL
 * after a full page reload (a real database round trip through the app's own API, not a
 * client-side cache).
 *
 * How it runs: this file lives in sysnapse/e2e and is injected into the product's own e2e
 * harness for the run (`pnpm test:e2e -- --spec=e2e-gate.spec.ts`). The harness boots
 * Postgres, runs migrations, starts the API and the Vite web server, so the assertion is
 * made against the app at the sha under test. Nothing is written back to the product repo.
 *
 * Isolation: account and bot names carry a timestamp, so the spec never depends on data left
 * by another test or on a seeded account. No fixed sleeps: every wait is a condition
 * (URL, element or placeholder).
 */
const stamp = Date.now();
const email = `e2e-gate-${stamp}@rakazo.test`;
const password = "password12";
const botName = `Gate Bot ${stamp}`;

test("a new account lands in a working chat and the bot it creates survives a reload", async ({
  page,
  baseURL,
}, testInfo) => {
  expect(baseURL, "the harness must export PLAYWRIGHT_BASE_URL").toBeTruthy();
  const origin = new URL(baseURL as string).origin;

  // 1. Create the account through the same endpoint the sign-up form posts to.
  const signUp = await page.request.post("/api/auth/sign-up/email", {
    data: { email, password, name: "E2E Gate" },
    headers: { origin },
  });
  expect(signUp.ok(), `sign-up ${signUp.status()}: ${await signUp.text()}`).toBe(true);

  // 2. Onboarding must land the account in a chat with its first bot, not on an error page.
  await page.goto("/onboarding");
  await page.waitForURL(/\/(onboarding|app)/, { timeout: 60_000 });
  const integrations = page.getByRole("heading", { name: "Server integrations", exact: true });
  const chiefComposer = page.getByPlaceholder(/Message Chief/);
  await expect(integrations.or(chiefComposer).first()).toBeVisible({ timeout: 60_000 });
  if (await integrations.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Skip", exact: true }).click();
  }
  await page.waitForURL(/\/app\/[^/]+$/, { timeout: 60_000 });
  await expect(chiefComposer).toBeVisible({ timeout: 30_000 });

  // 3. A bot created through the UI opens its own chat.
  await page.getByTestId("create-menu-trigger").click();
  await page.getByTestId("create-new-bot").click();
  const dialog = page.getByTestId("create-bot-dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.getByPlaceholder("Name your Bot").fill(botName);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  const botChatUrl = page.url();
  expect(botChatUrl).toMatch(/\/app\/[^/]+$/);
  await expect(page.getByPlaceholder(new RegExp(`Message ${botName}`))).toBeVisible({
    timeout: 30_000,
  });

  // 4. The bot is stored server-side: reloading its URL still resolves the same bot.
  await page.reload();
  await expect(page.getByPlaceholder(new RegExp(`Message ${botName}`))).toBeVisible({
    timeout: 30_000,
  });
  const roster = page.locator("aside").first();
  await expect(roster.getByRole("button", { name: new RegExp(`^${botName}`) })).toBeVisible({
    timeout: 30_000,
  });

  await testInfo.attach("gate-journey", {
    body: JSON.stringify({ email, botName, botChatUrl }, null, 2),
    contentType: "application/json",
  });
});
