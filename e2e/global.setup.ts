import { test as setup, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { ADMIN, CUSTOMER, STORAGE } from "./utils/env";
import { openEmailLogin } from "./utils/selectors";

/**
 * Signs in once per role and parks the session for every other spec to reuse.
 *
 * This deliberately drives the REAL login form rather than minting a session
 * token directly. It means the login path is exercised on every run — if the
 * form breaks, the whole suite fails loudly at setup instead of every
 * downstream spec failing for a confusing reason. Specs that test login
 * *behaviour* (wrong password, rate limits, Google button) live in
 * e2e/auth/login.spec.ts and start from a clean context.
 *
 * Note the tab: /login defaults to the Phone OTP method, so the Email tab has
 * to be selected before the credential fields exist.
 */

mkdirSync("e2e/.auth", { recursive: true });

async function signIn(
  page: import("@playwright/test").Page,
  creds: { email: string; password: string },
  landsOn: RegExp,
) {
  // Tolerates both layouts: with SMS configured the page shows tabs, without
  // it the password form stands alone. Scoped to <main> because the footer's
  // compact enquiry form has its own "Email" field on every page.
  const form = await openEmailLogin(page);
  const email = form.getByLabel("Email", { exact: true });
  await expect(email).toBeVisible();
  await email.fill(creds.email);
  await form.getByLabel("Password", { exact: true }).fill(creds.password);

  await form.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL(landsOn, { timeout: 30_000 });
}

setup("authenticate as customer", async ({ page }) => {
  await signIn(page, CUSTOMER, /\/(account)?$/);

  // Prove the session actually took before saving it — a storageState with no
  // session cookie fails every dependent spec with a misleading redirect.
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account/);
  await expect(page.getByRole("link", { name: /your account/i })).toBeVisible();

  await page.context().storageState({ path: STORAGE.customer });
});

setup("authenticate as admin", async ({ page }) => {
  await signIn(page, ADMIN, /\/(admin|account)?$/);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.context().storageState({ path: STORAGE.admin });
});
