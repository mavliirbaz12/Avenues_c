import { test, expect } from "../fixtures";
import { CUSTOMER } from "../utils/env";
import { main } from "../utils/selectors";
import { db } from "../utils/db";

/**
 * Signup. Each successful run creates a real user, so addresses are unique per
 * test rather than shared — a fixed address would pass once and then hit the
 * duplicate-email branch forever.
 */

let created: string[] = [];

test.afterAll(async () => {
  if (created.length) {
    await db.user.deleteMany({ where: { email: { in: created } } });
  }
  await db.$disconnect();
});

function uniqueEmail() {
  return `signup-${Date.now()}-${Math.round(Math.random() * 1e6)}@test.dev`;
}

test.describe("signup", () => {
  test("@smoke @desktop creates an account and lands signed in", async ({ page }) => {
    const email = uniqueEmail();
    created.push(email);

    await page.goto("/signup");
    const form = main(page);
    await form.getByLabel("Name", { exact: true }).fill("New Person");
    await form.getByLabel("Email", { exact: true }).fill(email);
    await form.getByLabel("Password", { exact: true }).fill("GoodPass123");
    await form.getByRole("button", { name: /create account/i }).click();

    // The form creates the account, then signs in from a useEffect, then
    // navigates. The nav only picks up the name after the server layout
    // re-renders, so assert on a fresh load rather than racing router.refresh().
    await page.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 30_000 });
    await page.goto("/account");
    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByRole("link", { name: /your account/i })).toBeVisible();

    const row = await db.user.findUnique({ where: { email } });
    expect(row, "user should exist in the database").not.toBeNull();
    expect(row?.role).toBe("CUSTOMER");
    expect(row?.passwordHash, "password must be hashed, never stored raw").not.toBe("GoodPass123");
  });

  test("a duplicate email is rejected", async ({ page }) => {
    await page.goto("/signup");
    const form = main(page);
    await form.getByLabel("Name", { exact: true }).fill("Impostor");
    await form.getByLabel("Email", { exact: true }).fill(CUSTOMER.email);
    await form.getByLabel("Password", { exact: true }).fill("GoodPass123");
    await form.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByText(/already|in use|exists/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).toHaveURL(/\/signup/);
  });

  test("a weak password is rejected and no user is created", async ({ page }) => {
    const email = uniqueEmail();

    await page.goto("/signup");
    const form = main(page);
    await form.getByLabel("Name", { exact: true }).fill("Weak Password");
    await form.getByLabel("Email", { exact: true }).fill(email);
    // No digit, under eight characters — the hint says both are required.
    await form.getByLabel("Password", { exact: true }).fill("abc");
    await form.getByRole("button", { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/signup/);
    expect(await db.user.findUnique({ where: { email } })).toBeNull();
  });

  test("an invalid email is rejected", async ({ page }) => {
    await page.goto("/signup");
    const form = main(page);
    await form.getByLabel("Name", { exact: true }).fill("Bad Email");
    await form.getByLabel("Email", { exact: true }).fill("not-an-email");
    await form.getByLabel("Password", { exact: true }).fill("GoodPass123");
    await form.getByRole("button", { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/signup/);
  });

  test("policy links are client-side navigations, not full reloads", async ({ page }) => {
    // These were plain <a> tags, which drop the SPA and re-download the bundle.
    await page.goto("/signup");

    // Marker survives a client-side navigation, dies on a document load.
    await page.evaluate(() => {
      (window as unknown as { __spa?: boolean }).__spa = true;
    });

    await main(page).getByRole("link", { name: /terms/i }).first().click();
    await page.waitForURL(/\/policies\/terms/);

    const survived = await page.evaluate(
      () => (window as unknown as { __spa?: boolean }).__spa === true,
    );
    expect(survived, "policy link should be a <Link>, not an <a>").toBe(true);
  });
});
