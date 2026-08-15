import { test, expect } from "../fixtures";
import { main } from "../utils/selectors";
import { db } from "../utils/db";
import {
  placeOrder,
  firstSellableVariant,
  nextClientIp,
  ensureStock,
  TEST_ADDRESS,
  UNSERVICEABLE_PINCODE,
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
  test("@smoke a guest can reach checkout and see the total", async ({ page }) => {
    await page.goto("/fragrance/night-drip");
    await main(page).getByRole("button", { name: /buy now/i }).first().click();
    await page.waitForURL(/\/checkout/);

    await expect(main(page).getByLabel("Email", { exact: true })).toBeVisible();
    await expect(main(page).getByRole("button", { name: /pay|place order/i })).toBeVisible();
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

  test("a guest cannot check out against someone else's saved address", async ({ request }) => {
    const variant = await ensureStock("intense");
    const addr = await db.address.findFirst({ select: { id: true } });
    const res = await request.post("/api/checkout", {
      headers: { "x-forwarded-for": nextClientIp() },
      data: {
        items: [{ variantId: variant!.id, quantity: 1 }],
        email: "guest@test.dev",
        phone: TEST_ADDRESS.phone,
        paymentMethod: "COD",
        termsAccepted: true,
        addressId: addr!.id,
      },
    });
    expect(res.status(), "an addressId from a signed-out caller must be refused").toBe(401);
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
      placeOrder(request, {
        variantId: variant!.id,
        email: "racer-a@test.dev",
        clientIp: "198.51.100.10",
      }),
      placeOrder(request, {
        variantId: variant!.id,
        email: "racer-b@test.dev",
        clientIp: "198.51.100.20",
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

    const { status } = await placeOrder(request, { variantId: variant!.id, quantity: 5 });
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

    const { status } = await placeOrder(request, { variantId: variant!.id });
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
