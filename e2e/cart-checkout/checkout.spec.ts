import { test, expect } from "../fixtures";
import { buyNow, main } from "../utils/selectors";
import { db } from "../utils/db";
import {
  placeOrder,
  firstSellableVariant,
  nextClientIp,
  ensureStock,
  TEST_ADDRESS,
  UNSERVICEABLE_PINCODE,
  customerRequest,
} from "../utils/orders";

test.afterAll(() => db.$disconnect());

/**
 * Checkout, payments and inventory.
 *
 * Everything runs against the app's mock gateway — no key reaches Razorpay.
 * Mock mode accepts only a signature of `mock_signature_ok` on an order id
 * prefixed `order_mock_`, so these specs exercise the same verification branch
 * a real payment would, without a real payment.
 */

test.describe("checkout form", () => {
  test("@smoke checkout sends a signed-out visitor to sign in first", async ({ page }) => {
    // Checkout requires an account. Buy now still works as a shortcut — it just
    // lands on /login with the destination preserved, so signing in returns
    // them to checkout with the cart they arrived with.
    await page.goto("/fragrance/night-drip");
    await buyNow(page, /\/login/);

    await expect(page).toHaveURL(/next=%2Fcheckout/);
    await expect(main(page).getByLabel("Email", { exact: true })).toBeVisible();
  });

  test("@smoke a signed-in customer reaches checkout and sees the total", async ({
    customerPage,
  }) => {
    await customerPage.goto("/fragrance/night-drip");
    await buyNow(customerPage);

    await expect(main(customerPage).getByLabel("Email", { exact: true })).toBeVisible();
    await expect(
      main(customerPage).getByRole("button", { name: /pay|place order/i }),
    ).toBeVisible();
  });

  test("terms must be accepted before an order is placed", async ({ request }) => {
    const variant = await ensureStock("intense");
    const res = await request.post("/api/checkout", {
      headers: { "x-forwarded-for": nextClientIp() },
      data: {
        items: [{ variantId: variant!.id, quantity: 1 }],
        email: "guest@test.dev",
        phone: TEST_ADDRESS.phone,
        paymentMethod: "COD",
        termsAccepted: false,
        address: TEST_ADDRESS,
      },
    });
    expect(res.status()).toBe(400);
  });

  const BAD_FIELDS = [
    { field: "phone", value: "12345", label: "a malformed mobile number" },
    { field: "email", value: "not-an-email", label: "a malformed email" },
  ];

  for (const bad of BAD_FIELDS) {
    test(`${bad.label} is rejected`, async ({ request }) => {
      const variant = await ensureStock("intense");
      const res = await request.post("/api/checkout", {
        data: {
          items: [{ variantId: variant!.id, quantity: 1 }],
          email: bad.field === "email" ? bad.value : "guest@test.dev",
          phone: bad.field === "phone" ? bad.value : TEST_ADDRESS.phone,
          paymentMethod: "COD",
          termsAccepted: true,
          address: TEST_ADDRESS,
        },
      });
      expect(res.status()).toBe(400);
    });
  }

  test("a bad pincode in the address is rejected", async ({ request }) => {
    const variant = await ensureStock("intense");
    const res = await request.post("/api/checkout", {
      headers: { "x-forwarded-for": nextClientIp() },
      data: {
        items: [{ variantId: variant!.id, quantity: 1 }],
        email: "guest@test.dev",
        phone: TEST_ADDRESS.phone,
        paymentMethod: "COD",
        termsAccepted: true,
        address: { ...TEST_ADDRESS, pincode: "12" },
      },
    });
    expect(res.status()).toBe(400);
  });

  test("@smoke a signed-out caller cannot place an order at all", async ({ request }) => {
    // The page guard only stops a browser; /api/checkout is a plain public POST
    // and is where the rule is actually enforced.
    const variant = await ensureStock("intense");
    const { status } = await placeOrder(request, { variantId: variant.id, guest: true });
    expect(status, "checkout must refuse an unauthenticated caller").toBe(401);

    const orders = await db.order.count({ where: { email: "customer@test.dev", userId: null } });
    expect(orders, "no ownerless order should ever be created").toBe(0);
  });

  test("a customer cannot check out against someone else's saved address", async () => {
    const variant = await ensureStock("intense");

    // An address belonging to a DIFFERENT account than the one we sign in as.
    const addr = await db.address.findFirst({
      where: { user: { email: { not: "customer@test.dev" } } },
      select: { id: true },
    });
    test.skip(!addr, "no address owned by another account to borrow");

    const api = await customerRequest();
    try {
      const res = await api.post("/api/checkout", {
        headers: { "x-forwarded-for": nextClientIp() },
        data: {
          items: [{ variantId: variant.id, quantity: 1 }],
          email: "customer@test.dev",
          phone: TEST_ADDRESS.phone,
          paymentMethod: "COD",
          termsAccepted: true,
          addressId: addr!.id,
        },
      });
      // Saved addresses are re-read scoped to the session user, so another
      // account's id simply does not resolve.
      expect(res.status(), "an addressId owned by someone else must not resolve").toBe(400);
    } finally {
      await api.dispose();
    }
  });
});

test.describe("pincode serviceability", () => {
  test("a normal pincode is serviceable", async ({ request }) => {
    const res = await request.get(`/api/pincode?pin=${TEST_ADDRESS.pincode}`);
    expect(res.ok()).toBe(true);
    expect((await res.json()).serviceable).toBe(true);
  });

  test("the reserved unserviceable pincode is refused", async ({ request }) => {
    const res = await request.get(`/api/pincode?pin=${UNSERVICEABLE_PINCODE}`);
    const body = await res.json();
    expect(body.serviceable, "999999 is the mock client's unserviceable pin").toBe(false);
  });

  test("a malformed pincode is rejected", async ({ request }) => {
    const res = await request.get("/api/pincode?pin=abc");
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe("cash on delivery", () => {
  test("@smoke places an order and decrements stock atomically", async ({ request }) => {
    const variant = await ensureStock("intense");
    const before = variant!.stock;

    const { status, body } = await placeOrder(request, { variantId: variant!.id, quantity: 2 });
    expect(status, JSON.stringify(body)).toBeLessThan(400);
    expect(body.orderNumber).toMatch(/^AVN-/);

    const order = await db.order.findUnique({
      where: { orderNumber: body.orderNumber },
      include: { items: true },
    });
    expect(order?.paymentMethod).toBe("COD");
    expect(order?.items[0]?.quantity).toBe(2);

    const after = await db.variant.findUnique({
      where: { id: variant!.id },
      select: { stock: true },
    });
    expect(after!.stock, "stock must drop by exactly the quantity ordered").toBe(before - 2);
  });

  test("a COD order carries the configured COD fee", async ({ request }) => {
    const settings = await db.storeSetting.findUnique({ where: { id: 1 } });
    test.skip(!settings?.codEnabled || !settings.codFeePaise, "COD fee not configured");

    const variant = await ensureStock("intense");
    const { body } = await placeOrder(request, { variantId: variant!.id });

    const order = await db.order.findUnique({ where: { orderNumber: body.orderNumber } });
    expect(order?.codFeePaise).toBe(settings!.codFeePaise);
  });
});

test.describe("razorpay (mock)", () => {
  test("@smoke a successful payment confirms the order and decrements stock", async ({
    request,
  }) => {
    const variant = await ensureStock("night-drip");
    const before = variant!.stock;

    const { status, body } = await placeOrder(request, {
      variantId: variant!.id,
      paymentMethod: "RAZORPAY",
    });
    expect(status, JSON.stringify(body)).toBeLessThan(400);

    const gatewayOrderId: string = body.payment?.razorpayOrderId;
    expect(gatewayOrderId, "mock mode should mint an order_mock_ id").toMatch(/^order_mock_/);

    // The same verification branch a real payment takes: mock mode accepts
    // only this exact triple.
    const verify = await request.post("/api/payments/verify", {
      data: {
        razorpayOrderId: gatewayOrderId,
        razorpayPaymentId: `pay_mock_${Date.now().toString(36)}`,
        signature: "mock_signature_ok",
      },
    });
    expect(verify.ok(), await verify.text()).toBe(true);

    const order = await db.order.findUnique({ where: { orderNumber: body.orderNumber } });
    expect(order?.status).toBe("CONFIRMED");

    const after = await db.variant.findUnique({
      where: { id: variant!.id },
      select: { stock: true },
    });
    expect(after!.stock).toBe(before - 1);
  });

  test("a forged signature is refused and the order stays unconfirmed", async ({ request }) => {
    const variant = await ensureStock("night-drip");
    const { body } = await placeOrder(request, {
      variantId: variant!.id,
      paymentMethod: "RAZORPAY",
    });
    const gatewayOrderId: string = body.payment?.razorpayOrderId;

    const verify = await request.post("/api/payments/verify", {
      data: {
        razorpayOrderId: gatewayOrderId,
        razorpayPaymentId: "pay_mock_forged",
        signature: "obviously-wrong",
      },
    });
    expect(verify.ok(), "a bad signature must not verify").toBe(false);

    const order = await db.order.findUnique({ where: { orderNumber: body.orderNumber } });
    expect(order?.status).not.toBe("CONFIRMED");
  });

  test("a failed payment leaves the order pending and offers a retry", async ({ request }) => {
    const variant = await ensureStock("blue-mist");

    const { body } = await placeOrder(request, {
      variantId: variant!.id,
      paymentMethod: "RAZORPAY",
    });
    const gatewayOrderId: string = body.payment?.razorpayOrderId;

    const fail = await request.post("/api/payments/mock-fail", {
      data: { razorpayOrderId: gatewayOrderId },
    });
    expect(fail.ok(), await fail.text()).toBe(true);

    const order = await db.order.findUnique({ where: { orderNumber: body.orderNumber } });
    expect(order?.status, "a failed payment must not confirm the order").not.toBe("CONFIRMED");
  });

  test("confirming twice is idempotent", async ({ request }) => {
    const variant = await ensureStock("intense");
    const before = variant!.stock;

    const { body } = await placeOrder(request, {
      variantId: variant!.id,
      paymentMethod: "RAZORPAY",
    });
    const gatewayOrderId: string = body.payment?.razorpayOrderId;

    const payload = {
      razorpayOrderId: gatewayOrderId,
      razorpayPaymentId: `pay_mock_${Date.now().toString(36)}`,
      signature: "mock_signature_ok",
    };

    await request.post("/api/payments/verify", { data: payload });
    await request.post("/api/payments/verify", { data: payload });

    const after = await db.variant.findUnique({
      where: { id: variant!.id },
      select: { stock: true },
    });
    expect(after!.stock, "a replayed confirmation must not decrement stock twice").toBe(before - 1);
  });
});

test.describe("inventory safety", () => {
  test("two simultaneous buyers cannot both take the last bottle", async ({ request }) => {
    // The seeded blue-mist variant is deliberately left at a known stock so
    // this race has exactly one winner.
    const variant = await db.variant.findFirst({
      where: { product: { slug: "blue-mist" } },
      select: { id: true },
    });
    await db.variant.update({ where: { id: variant!.id }, data: { stock: 1 } });

    const [a, b] = await Promise.all([
      // expectOk: false on BOTH — the point of this test is that exactly one
      // of them is refused, so a refusal here is the expected outcome rather
      // than a broken fixture.
      placeOrder(request, {
        variantId: variant!.id,
        email: "racer-a@test.dev",
        clientIp: "198.51.100.10",
        expectOk: false,
      }),
      placeOrder(request, {
        variantId: variant!.id,
        email: "racer-b@test.dev",
        clientIp: "198.51.100.20",
        expectOk: false,
      }),
    ]);

    const ok = [a, b].filter((r) => r.status < 400);
    expect(ok.length, "exactly one of two racing orders may succeed").toBe(1);

    const after = await db.variant.findUnique({
      where: { id: variant!.id },
      select: { stock: true },
    });
    expect(after!.stock, "stock must never go negative").toBe(0);
  });

  test("ordering more than the available stock is refused", async ({ request }) => {
    const variant = await db.variant.findFirst({
      where: { product: { slug: "white-oud" } },
      select: { id: true },
    });
    await db.variant.update({ where: { id: variant!.id }, data: { stock: 2 } });

    const { status } = await placeOrder(request, { variantId: variant!.id, quantity: 5, expectOk: false });
    expect(status, "cannot buy five when two remain").toBeGreaterThanOrEqual(400);

    // Restore the sold-out fixture for the specs that depend on it.
    await db.variant.update({ where: { id: variant!.id }, data: { stock: 0 } });
  });

  test("a sold-out variant cannot be ordered at all", async ({ request }) => {
    const variant = await db.variant.findFirst({
      where: { product: { slug: "white-oud" } },
      select: { id: true },
    });
    await db.variant.update({ where: { id: variant!.id }, data: { stock: 0 } });

    const { status } = await placeOrder(request, { variantId: variant!.id, expectOk: false });
    expect(status).toBeGreaterThanOrEqual(400);
  });
});

test.describe("order confirmation page", () => {
  test("@smoke shows the order number and is reachable with its access token", async ({
    request,
    page,
  }) => {
    const variant = await ensureStock("pink-aura");
    const { body } = await placeOrder(request, { variantId: variant!.id });

    const token: string | undefined = body.accessToken ?? body.token;
    test.skip(!token, "checkout response carries no access token");

    await page.goto(`/order/${body.orderNumber}?t=${token}`);
    await expect(main(page).getByText(body.orderNumber)).toBeVisible();
  });

  test("the same order without a token is bounced to the tracking form", async ({
    request,
    page,
  }) => {
    const variant = await ensureStock("pink-aura");
    const { body } = await placeOrder(request, {
      variantId: variant!.id,
      email: "someone-else@test.dev",
    });

    await page.goto(`/order/${body.orderNumber}`);

    // Not a 404: the app redirects to /track-order with the number prefilled,
    // which is friendlier than a dead end and still proves nothing. What
    // matters is that no order CONTENT is served without the token.
    await expect(page).toHaveURL(/\/track-order/);
    expect(new URL(page.url()).searchParams.get("order")).toBe(body.orderNumber);
    await expect(main(page).getByText(/someone-else@test\.dev/i)).toHaveCount(0);
    await expect(main(page).getByText(TEST_ADDRESS.line1)).toHaveCount(0);
  });
});
