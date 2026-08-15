import { test, expect, allowConsoleErrors } from "../fixtures";

/**
 * The protection matrix. This is the spec that matters most on this file:
 * a regression here leaks a customer's orders or hands the admin panel to
 * anyone who guesses the URL.
 *
 * Note the app's two different rejection styles, both deliberate:
 *   - no session      → redirect to /login?next=<where you were going>
 *   - wrong role      → redirect to /not-found, so /admin never confirms it
 *                       exists to a signed-in customer
 */

const ACCOUNT_ROUTES = ["/account", "/account/orders", "/account/addresses"];

const ADMIN_ROUTES = [
  "/admin",
  "/admin/products",
  "/admin/orders",
  "/admin/coupons",
  "/admin/customers",
  "/admin/reviews",
  "/admin/enquiries",
  "/admin/newsletter",
  "/admin/collections",
  "/admin/settings",
];

test.describe("guests", () => {
  for (const path of ACCOUNT_ROUTES) {
    test(`@smoke ${path} bounces a guest to login, preserving the destination`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
      expect(new URL(page.url()).searchParams.get("next")).toBe(path);
    });
  }

  for (const path of ADMIN_ROUTES.slice(0, 4)) {
    test(`${path} bounces a guest to login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
      // Nothing from the admin shell should have rendered on the way past.
      await expect(page.getByRole("navigation", { name: /admin/i })).toHaveCount(0);
    });
  }
});

test.describe("signed-in customers", () => {
  for (const path of ADMIN_ROUTES) {
    test(`@smoke ${path} is not reachable and renders no admin content`, async ({
      customerPage,
    }) => {
      // The guard redirects to /not-found, so Chromium logs the 404 for the
      // document. That IS the expected outcome here.
      allowConsoleErrors(customerPage);
      const res = await customerPage.goto(path);

      // A customer must never see the panel. The app 404s rather than saying
      // "forbidden", so assert on content, not just status.
      expect(res?.status(), `${path} should not be 200 for a customer`).not.toBe(200);
      await expect(customerPage.getByRole("navigation", { name: /admin/i })).toHaveCount(0);

      // Sample the things an admin page would show.
      await expect(
        customerPage.getByRole("link", { name: /^new product$/i }),
      ).toHaveCount(0);
      await expect(customerPage.getByRole("button", { name: /save settings/i })).toHaveCount(0);
    });
  }

  test("account routes are reachable", async ({ customerPage }) => {
    for (const path of ACCOUNT_ROUTES) {
      const res = await customerPage.goto(path);
      expect(res?.status(), `${path} should be 200 for its owner`).toBe(200);
      await expect(customerPage).toHaveURL(new RegExp(path.replace("/", "\\/")));
    }
  });
});

test.describe("admins", () => {
  for (const path of ADMIN_ROUTES) {
    test(`@smoke ${path} is reachable`, async ({ adminPage }) => {
      const res = await adminPage.goto(path);
      expect(res?.status(), `${path} should be 200 for an admin`).toBe(200);
      await expect(adminPage.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }
});

test.describe("API endpoints", () => {
  test("wishlist writes require a session", async ({ request }) => {
    const res = await request.post("/api/wishlist", { data: { productId: "anything" } });
    expect(res.status()).toBe(401);
  });

  test("guest/DB sync requires a session", async ({ request }) => {
    const res = await request.post("/api/sync", { data: {} });
    expect(res.status()).toBe(401);
  });

  test("admin upload rejects a guest", async ({ request }) => {
    const res = await request.post("/api/admin/upload", {
      multipart: { productId: "x", file: { name: "a.png", mimeType: "image/png", buffer: Buffer.from("x") } },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("newsletter CSV export rejects a guest", async ({ request }) => {
    const res = await request.get("/api/admin/newsletter.csv");
    expect([401, 403]).toContain(res.status());
  });

  test("newsletter CSV export rejects a signed-in customer", async ({ customerPage }) => {
    const res = await customerPage.request.get("/api/admin/newsletter.csv");
    expect(res.status()).toBe(403);
  });

  test("the stock-release cron requires its bearer token", async ({ request }) => {
    const res = await request.get("/api/cron/release-stock");
    expect(res.status()).toBe(401);
  });

  test("razorpay webhook rejects an unsigned payload", async ({ request }) => {
    const res = await request.post("/api/webhooks/razorpay", {
      data: { event: "payment.captured" },
    });
    expect(res.status()).toBe(401);
  });

  test("delhivery webhook rejects an unsigned payload", async ({ request }) => {
    const res = await request.post("/api/webhooks/delhivery", { data: { Shipment: {} } });
    expect(res.status()).toBe(401);
  });
});

test.describe("order access", () => {
  test("another customer's order is not readable without a token", async ({ customerPage }) => {
    allowConsoleErrors(customerPage);
    // A well-formed but unowned order number must 404, not leak.
    const res = await customerPage.goto("/order/AVN-ZZZZZZ");
    expect(res?.status()).toBe(404);
  });
});
