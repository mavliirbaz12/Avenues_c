import { test, expect, allowConsoleErrors } from "../fixtures";
import { CUSTOMER } from "../utils/env";
import { main, openEmailLogin, phoneOtpOffered } from "../utils/selectors";

/**
 * Login behaviour. Signing in *successfully* is already proven by global
 * setup, so these specs concentrate on what setup can't cover: the failure
 * branches, the tab switch, and the Google affordance.
 */

async function openEmailTab(page: import("@playwright/test").Page) {
  await openEmailLogin(page);
}

test.describe("login", () => {
  test("@smoke phone OTP is offered only when SMS is configured", async ({ page }) => {
    // Without MSG91 the app prints codes to the server console, which is
    // useless in production — so the option is hidden rather than offered and
    // broken. This asserts whichever state the environment is in, and that the
    // password door always works.
    await page.goto("/login");
    const otp = await phoneOtpOffered(page);

    if (otp) {
      const phoneTab = page.getByRole("tab", { name: "Phone OTP" });
      await expect(phoneTab).toHaveAttribute("aria-selected", "true");
      await expect(main(page).getByLabel("Mobile number")).toBeVisible();
      await page.getByRole("tab", { name: "Email" }).click();
    } else {
      // No tab bar at all — a disabled tab raises a question the page cannot
      // answer.
      await expect(page.getByRole("tablist")).toHaveCount(0);
      await expect(main(page).getByLabel("Mobile number")).toHaveCount(0);
    }

    await expect(main(page).getByLabel("Email", { exact: true })).toBeVisible();
    await expect(main(page).getByLabel("Password", { exact: true })).toBeVisible();
  });

  test("@desktop correct credentials sign in and the nav shows the user's name", async ({ page }) => {
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

  test("@smoke no social sign-in is offered", async ({ page }) => {
    // Google sign-in was removed deliberately. Asserting its absence, rather
    // than just deleting the old spec, stops a half-finished re-enable from
    // shipping a button that leads nowhere.
    for (const path of ["/login", "/signup"]) {
      await page.goto(path);
      await expect(main(page).getByRole("button", { name: /google/i })).toHaveCount(0);
      await expect(main(page).getByText(/continue with/i)).toHaveCount(0);
    }
  });

  test("the Google OAuth endpoint does not start a flow", async ({ request }) => {
    // The provider is unregistered, not merely hidden, so this URL must not
    // begin a handshake for anyone who types it directly.
    const res = await request.get("/api/auth/signin/google", { maxRedirects: 0 });
    const location = res.headers()["location"] ?? "";
    expect(location, "must not redirect to Google").not.toMatch(/accounts\.google\.com/);
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
  // Skipped wholesale when SMS is unconfigured — there is no phone door to
  // test, which is itself asserted above.
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    test.skip(!(await phoneOtpOffered(page)), "SMS is not configured in this environment");
  });

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

  test("@desktop signing out clears the session and re-guards account routes", async ({ customerPage }) => {
    // Signing out invalidates the session mid-flight, so client fetches that
    // were already in the air come back 401. That is the expected shape of a
    // sign-out, not an error worth failing on.
    allowConsoleErrors(customerPage);
    await customerPage.goto("/account");
    await expect(customerPage).toHaveURL(/\/account/);

    await customerPage.getByRole("button", { name: /sign out|log ?out/i }).first().click();

    await customerPage.waitForURL((u) => !u.pathname.startsWith("/account"), { timeout: 20_000 });
    await customerPage.goto("/account");
    await expect(customerPage).toHaveURL(/\/login/);
  });
});
