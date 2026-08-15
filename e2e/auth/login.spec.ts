import { test, expect } from "../fixtures";
import { CUSTOMER } from "../utils/env";
import { main } from "../utils/selectors";

/**
 * Login behaviour. Signing in *successfully* is already proven by global
 * setup, so these specs concentrate on what setup can't cover: the failure
 * branches, the tab switch, and the Google affordance.
 */

async function openEmailTab(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByRole("tab", { name: "Email" }).click();
}

test.describe("login", () => {
  test("@smoke defaults to the phone tab and switches to email", async ({ page }) => {
    await page.goto("/login");

    const phoneTab = page.getByRole("tab", { name: "Phone OTP" });
    const emailTab = page.getByRole("tab", { name: "Email" });

    await expect(phoneTab).toHaveAttribute("aria-selected", "true");
    await expect(main(page).getByLabel("Mobile number")).toBeVisible();

    await emailTab.click();
    await expect(emailTab).toHaveAttribute("aria-selected", "true");
    await expect(main(page).getByLabel("Email", { exact: true })).toBeVisible();
    await expect(main(page).getByLabel("Password", { exact: true })).toBeVisible();
  });

  test("correct credentials sign in and the nav shows the user's name", async ({ page }) => {
    await openEmailTab(page);
    const form = main(page);
    await form.getByLabel("Email", { exact: true }).fill(CUSTOMER.email);
    await form.getByLabel("Password", { exact: true }).fill(CUSTOMER.password);
    await form.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL((u) => !u.pathname.startsWith("/login"));

    // Signed out the control reads "Login"; signed in it carries the first name.
    const account = page.getByRole("link", { name: /your account/i });
    await expect(account).toBeVisible();
    await expect(account).toContainText(CUSTOMER.name.split(" ")[0]);
  });

  test("wrong password shows an error and creates no session", async ({ page }) => {
    await openEmailTab(page);
    const form = main(page);
    await form.getByLabel("Email", { exact: true }).fill(CUSTOMER.email);
    await form.getByLabel("Password", { exact: true }).fill("definitely-not-it");
    await form.getByRole("button", { name: "Sign in" }).click();

    await expect(main(page).getByRole("alert").first()).toHaveText(/don't match/i);
    // Still on /login, and the guarded route still bounces.
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/);
  });

  test("an unknown email gets the same message as a wrong password", async ({ page }) => {
    // Account enumeration: the two failures must be indistinguishable.
    await openEmailTab(page);
    const form = main(page);
    await form.getByLabel("Email", { exact: true }).fill("nobody-here@test.dev");
    await form.getByLabel("Password", { exact: true }).fill("whatever-123");
    await form.getByRole("button", { name: "Sign in" }).click();

    await expect(main(page).getByRole("alert").first()).toHaveText(/don't match/i);
  });

  test("password visibility toggle reveals and re-hides", async ({ page }) => {
    await openEmailTab(page);
    const form = main(page);
    const password = form.getByLabel("Password", { exact: true });
    await password.fill("hunter2");
    await expect(password).toHaveAttribute("type", "password");

    const show = form.getByRole("button", { name: /show password/i });
    await show.click();
    await expect(password).toHaveAttribute("type", "text");

    await form.getByRole("button", { name: /hide password/i }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("@smoke Google sign-in is offered above the tabs and starts the OAuth handoff", async ({
    page,
  }) => {
    await page.goto("/login");

    // Above the tab bar on purpose: nested inside the Email tab it was
    // invisible to anyone landing on the default Phone OTP tab.
    const google = main(page).getByRole("button", { name: /google/i });
    await expect(google).toBeVisible();

    // On-brand, not Google's default light button.
    await expect(google).toHaveCSS("background-color", /rgba?\(\s*(1[0-9]|2[0-9]|[0-9])\s*,/);

    // Start the handoff but never complete it — assert we leave for the
    // provider rather than following a real OAuth round-trip.
    const [request] = await Promise.all([
      page.waitForRequest(
        (r) => /accounts\.google\.com|\/api\/auth\/(signin|callback)\/google/.test(r.url()),
        { timeout: 15_000 },
      ),
      google.click(),
    ]);
    expect(request.url()).toMatch(/google/);
  });

  test("Google sign-in is also offered on signup", async ({ page }) => {
    await page.goto("/signup");
    await expect(main(page).getByRole("button", { name: /google/i })).toBeVisible();
  });

  test("forgot-password link reaches the request form and it reports success", async ({ page }) => {
    await openEmailTab(page);
    await main(page).getByRole("link", { name: /forgot/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);

    const form = main(page);
    await form.getByLabel("Email", { exact: true }).fill(CUSTOMER.email);
    await form.getByRole("button", { name: /send|reset/i }).click();

    // Must not disclose whether the address exists.
    await expect(form.getByRole("status")).toBeVisible();
  });

  test("an unknown email on forgot-password looks identical to a known one", async ({ page }) => {
    await page.goto("/forgot-password");
    const form = main(page);
    await form.getByLabel("Email", { exact: true }).fill("nobody-here@test.dev");
    await form.getByRole("button", { name: /send|reset/i }).click();
    await expect(form.getByRole("status")).toBeVisible();
  });
});

test.describe("phone OTP", () => {
  test("requests a code and asks for six digits", async ({ page }) => {
    await page.goto("/login");
    const form = main(page);

    await form.getByLabel("Mobile number").fill("9876500011");
    await form.getByRole("button", { name: /send code/i }).click();

    await expect(form.getByLabel("6-digit code")).toBeVisible({ timeout: 20_000 });
    await expect(form.getByRole("status")).toBeVisible();
    // Verify stays disabled until six digits are present.
    await expect(form.getByRole("button", { name: /verify/i })).toBeDisabled();
  });

  test("rejects a wrong code without signing in", async ({ page }) => {
    await page.goto("/login");
    const form = main(page);
    await form.getByLabel("Mobile number").fill("9876500012");
    await form.getByRole("button", { name: /send code/i }).click();

    const code = form.getByLabel("6-digit code");
    await expect(code).toBeVisible({ timeout: 20_000 });
    await code.fill("000000");
    await form.getByRole("button", { name: /verify/i }).click();

    await expect(main(page).getByRole("alert").first()).toContainText(/doesn't match|expired/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test("rejects a malformed mobile number", async ({ page }) => {
    await page.goto("/login");
    const form = main(page);
    await form.getByLabel("Mobile number").fill("12345");
    await form.getByRole("button", { name: /send code/i }).click();

    // Never advances to the code step.
    await expect(form.getByLabel("6-digit code")).toHaveCount(0);
  });
});

test.describe("session lifecycle", () => {
  test("signed-in users are redirected away from /login and /signup", async ({ customerPage }) => {
    await customerPage.goto("/login");
    await expect(customerPage).not.toHaveURL(/\/login/);

    await customerPage.goto("/signup");
    await expect(customerPage).not.toHaveURL(/\/signup/);
  });

  test("signing out clears the session and re-guards account routes", async ({ customerPage }) => {
    await customerPage.goto("/account");
    await expect(customerPage).toHaveURL(/\/account/);

    await customerPage.getByRole("button", { name: /sign out|log ?out/i }).first().click();

    await customerPage.waitForURL((u) => !u.pathname.startsWith("/account"), { timeout: 20_000 });
    await customerPage.goto("/account");
    await expect(customerPage).toHaveURL(/\/login/);
  });
});
