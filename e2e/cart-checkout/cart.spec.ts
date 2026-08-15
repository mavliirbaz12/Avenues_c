import { test, expect } from "../fixtures";
import { main, cartDrawer, openCouponField } from "../utils/selectors";
import { db } from "../utils/db";

test.afterAll(() => db.$disconnect());

/**
 * Cart and coupons.
 *
 * Pricing is asserted against the server, never against arithmetic done in the
 * spec: the point of server-side recomputation is that the client's numbers
 * are not authoritative, and a test that recomputes them locally would agree
 * with a tampered client.
 */

async function addFirstProduct(page: import("@playwright/test").Page, slug = "night-drip") {
  await page.goto(`/fragrance/${slug}`);
  await main(page).getByRole("button", { name: "Add to cart" }).first().click();
  await expect(cartDrawer(page)).toBeVisible();
}

test.describe("cart", () => {
  test("@smoke add from the PDP, then adjust and remove", async ({ page }) => {
    await addFirstProduct(page);
    const drawer = cartDrawer(page);

    await expect(drawer.getByText(/night drip/i).first()).toBeVisible();

    // Quantity up, total should follow.
    const inc = drawer.getByRole("button", { name: /increase/i }).first();
    if (await inc.count()) {
      await inc.click();
      await expect(drawer.getByText(/₹/).first()).toBeVisible();
    }

    const remove = drawer.getByRole("button", { name: /remove/i }).first();
    if (await remove.count()) {
      await remove.click();
      await expect(drawer.getByText(/waiting for its first obsession/i)).toBeVisible();
    }
  });

  test("empty cart has personality, not a blank panel", async ({ page }) => {
    await page.goto("/cart");
    await expect(main(page).getByText(/waiting for its first obsession/i)).toBeVisible();
    await expect(main(page).getByRole("link", { name: /shop the five/i })).toBeVisible();
  });

  test("the cart survives a reload for a guest", async ({ page }) => {
    await addFirstProduct(page);
    await page.keyboard.press("Escape");

    await page.goto("/cart");
    await expect(main(page).getByText(/night drip/i).first()).toBeVisible();

    await page.reload();
    await expect(main(page).getByText(/night drip/i).first()).toBeVisible();
  });

  test("@smoke a guest cart merges into the account on login", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await addFirstProduct(page, "pink-aura");
    await page.keyboard.press("Escape");

    // Sign in from the guest session; SessionSync merges the local cart.
    await page.goto("/login");
    await page.getByRole("tab", { name: "Email" }).click();
    await main(page).getByLabel("Email", { exact: true }).fill("customer@test.dev");
    await main(page).getByLabel("Password", { exact: true }).fill("CustomerTest!2026");
    await main(page).getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));

    await page.goto("/cart");
    await expect(
      main(page).getByText(/pink aura/i).first(),
      "the guest cart must survive signing in",
    ).toBeVisible();

    await ctx.close();
  });

  test("pricing comes from the server", async ({ request }) => {
    const variant = await db.variant.findFirst({
      where: { isActive: true, stock: { gt: 0 } },
      select: { id: true, pricePaise: true },
    });

    const res = await request.post("/api/cart/price", {
      data: { items: [{ variantId: variant!.id, quantity: 2 }] },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();

    expect(body.subtotalPaise, "subtotal must be computed from the DB price").toBe(
      variant!.pricePaise * 2,
    );
  });

  test("a forged client price is ignored", async ({ request }) => {
    const variant = await db.variant.findFirst({
      where: { isActive: true, stock: { gt: 0 } },
      select: { id: true, pricePaise: true },
    });

    // Send a line claiming the item costs ₹1. The server must price it itself.
    const res = await request.post("/api/cart/price", {
      data: { items: [{ variantId: variant!.id, quantity: 1, pricePaise: 100, price: 100 }] },
    });
    const body = await res.json();
    expect(body.subtotalPaise, "client-supplied prices must be discarded").toBe(variant!.pricePaise);
  });
});

test.describe("coupons", () => {
  /** Applies a code in the drawer and returns the message shown. */
  async function applyCode(page: import("@playwright/test").Page, code: string) {
    const drawer = cartDrawer(page);
    await openCouponField(drawer);
    await drawer.getByLabel("Coupon code").fill(code);
    await drawer.getByRole("button", { name: "Apply" }).click();
    return drawer;
  }

  test("@smoke a valid flat coupon discounts the total server-side", async ({ page, request }) => {
    await addFirstProduct(page);
    const drawer = await applyCode(page, "E2EFLAT100");

    await expect(drawer.getByRole("status").first()).toContainText(/applied/i, {
      timeout: 15_000,
    });

    // Cross-check against the pricing endpoint rather than trusting the UI.
    const variant = await db.variant.findFirst({
      where: { product: { slug: "night-drip" } },
      select: { id: true, pricePaise: true },
    });
    const res = await request.post("/api/cart/price", {
      data: { items: [{ variantId: variant!.id, quantity: 1 }], couponCode: "E2EFLAT100" },
    });
    const body = await res.json();
    expect(body.discountPaise, "flat ₹100 off").toBe(10_000);
  });

  test("a percentage coupon respects its cap", async ({ request }) => {
    const variant = await db.variant.findFirst({
      where: { product: { slug: "night-drip" } },
      select: { id: true, pricePaise: true },
    });
    // 10% of a large order would exceed the ₹150 cap.
    const res = await request.post("/api/cart/price", {
      data: { items: [{ variantId: variant!.id, quantity: 5 }], couponCode: "E2EPCT10" },
    });
    const body = await res.json();
    expect(body.discountPaise, "capped at ₹150").toBeLessThanOrEqual(15_000);
  });

  const REJECTED = [
    { code: "NOSUCHCODE", why: "unknown" },
    { code: "E2EEXPIRED", why: "ended yesterday" },
    { code: "E2EFUTURE", why: "not started" },
    { code: "E2EUSEDUP", why: "usage limit reached" },
    { code: "E2EDISABLED", why: "disabled in admin" },
    { code: "E2EMIN5000", why: "under the minimum order" },
  ];

  for (const { code, why } of REJECTED) {
    test(`${code} is rejected (${why})`, async ({ request }) => {
      const variant = await db.variant.findFirst({
        where: { product: { slug: "night-drip" } },
        select: { id: true },
      });
      const res = await request.post("/api/cart/price", {
        data: { items: [{ variantId: variant!.id, quantity: 1 }], couponCode: code },
      });
      const body = await res.json();
      expect(body.discountPaise ?? 0, `${code} must not discount`).toBe(0);
    });
  }

  test("an unknown code and a disabled code are indistinguishable", async ({ request }) => {
    // Otherwise the endpoint is a coupon-enumeration oracle.
    const variant = await db.variant.findFirst({
      where: { product: { slug: "night-drip" } },
      select: { id: true },
    });
    const ask = async (couponCode: string) => {
      const r = await request.post("/api/cart/price", {
        data: { items: [{ variantId: variant!.id, quantity: 1 }], couponCode },
      });
      const b = await r.json();
      return b.coupon?.message ?? null;
    };

    const unknown = await ask("TOTALLYMADEUP");
    const disabled = await ask("E2EDISABLED");
    expect(disabled, "a disabled code must not be distinguishable from a fake one").toBe(unknown);
  });

  test("an invalid code shows an error in the drawer and applies nothing", async ({ page }) => {
    await addFirstProduct(page);
    const drawer = await applyCode(page, "NOPENOPENOPE");

    // The field reports the rejection and marks itself invalid. Note the
    // drawer legitimately shows a saving from the MRP-vs-offer difference, so
    // asserting on "you save" would fail against correct behaviour; and a
    // Remove control staying available to clear the bad code is fine too.
    await expect(drawer.getByRole("alert").first()).toBeVisible({ timeout: 15_000 });
    await expect(drawer.getByLabel("Coupon code")).toHaveAttribute("aria-invalid", "true");
    await expect(drawer.getByRole("status")).toHaveCount(0);
  });
});
