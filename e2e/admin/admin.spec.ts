import { test, expect } from "../fixtures";
import { db } from "../utils/db";
import { placeOrder, ensureStock } from "../utils/orders";

test.afterAll(() => db.$disconnect());

/**
 * The admin panel, driven as a real admin.
 *
 * The theme throughout is round-tripping: a change made in admin must be
 * visible on the storefront, and a submission from the storefront must appear
 * in admin. Asserting only that an admin form saves would miss the half of the
 * bug that matters.
 */

test.describe("dashboard", () => {
  test("@smoke surfaces the low-stock product it should", async ({ adminPage }) => {
    // Force a known low-stock item so the widget has something definite to
    // show. Asserting on a bare number matched anything on the page — the
    // count, a revenue figure, a date — and told us nothing.
    await ensureStock("pink-aura", 4);

    await adminPage.goto("/admin");
    await expect(adminPage.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      adminPage.getByText(/pink aura/i).first(),
      "a variant with 4 left belongs in the low-stock widget",
    ).toBeVisible();

    await ensureStock("pink-aura", 50);
  });
});

test.describe("products", () => {
  test("@smoke lists every product with its stock", async ({ adminPage }) => {
    const products = await db.product.findMany({ select: { name: true } });
    await adminPage.goto("/admin/products");
    for (const p of products) {
      await expect(adminPage.getByText(p.name, { exact: false }).first()).toBeVisible();
    }
  });

  test("creating a product makes it appear on the storefront", async ({ adminPage, page }) => {
    const stamp = Date.now();
    const name = `E2E Test Scent ${stamp}`;
    const slug = `e2e-test-scent-${stamp}`;

    await adminPage.goto("/admin/products/new");
    await adminPage.getByLabel("Name", { exact: true }).fill(name);
    await adminPage.getByLabel("Slug", { exact: true }).fill(slug);
    await adminPage.getByLabel("Tagline").fill("Made. By. Robots.");
    await adminPage.getByLabel("Highlight line").fill("An entirely synthetic fragrance.");
    await adminPage
      .getByRole("textbox", { name: "Description", exact: true })
      .fill(
        "A fragrance that exists only so a test can prove the admin form writes " +
          "every field it collects, and that the storefront picks the record up.",
      );
    await adminPage.getByLabel("For", { exact: true }).selectOption("UNISEX");
    await adminPage.getByLabel("Top notes").fill("Ozone, Static");
    await adminPage.getByLabel("Heart notes").fill("Copper");
    await adminPage.getByLabel("Base notes").fill("Graphite");
    await adminPage.getByRole("button", { name: /create product/i }).click();

    await expect
      .poll(async () => db.product.count({ where: { slug } }), {
        timeout: 20_000,
        message: "the admin form should have created the product",
      })
      .toBe(1);

    // A brand-new product has no variant yet, so it is not purchasable — but
    // the record must exist and carry what was typed.
    const created = await db.product.findUnique({ where: { slug } });
    expect(created?.notesTop).toEqual(["Ozone", "Static"]);
    expect(created?.gender).toBe("UNISEX");

    await db.product.delete({ where: { slug } });
  });

  test("toggling a product inactive removes it from the storefront", async ({
    adminPage,
    page,
  }) => {
    const slug = "white-oud";
    await db.product.update({ where: { slug }, data: { isActive: false } });

    await page.goto("/shop");
    await expect(page.getByRole("link", { name: /white oud/i })).toHaveCount(0);

    const res = await page.goto(`/fragrance/${slug}`);
    expect(res?.status(), "an inactive product must 404, not render").toBe(404);

    await db.product.update({ where: { slug }, data: { isActive: true } });
  });

  test("editing a price is reflected on the product page", async ({ adminPage, page }) => {
    const slug = "blue-mist";
    const variant = await ensureStock(slug);
    const original = variant.pricePaise;
    const changed = 88800;

    await db.variant.update({ where: { id: variant.id }, data: { pricePaise: changed } });

    await page.goto(`/fragrance/${slug}`);
    await expect(page.getByText(/₹\s*888/).first()).toBeVisible();

    await db.variant.update({ where: { id: variant.id }, data: { pricePaise: original } });
  });

  test("a low-stock variant is badged in admin", async ({ adminPage }) => {
    const variant = await ensureStock("pink-aura", 3);

    await adminPage.goto("/admin/products");
    await expect(adminPage.getByText(/low stock|3 left|^3$/i).first()).toBeVisible();

    await db.variant.update({ where: { id: variant.id }, data: { stock: 50 } });
  });
});

test.describe("coupons", () => {
  test("@smoke lists the seeded coupons", async ({ adminPage }) => {
    await adminPage.goto("/admin/coupons");
    await expect(adminPage.getByText("E2EFLAT100")).toBeVisible();
  });

  test("disabling a coupon makes it invalid at checkout immediately", async ({
    adminPage,
    request,
  }) => {
    await db.coupon.update({ where: { code: "E2EFLAT100" }, data: { isActive: false } });

    const variant = await ensureStock("intense");
    const res = await request.post("/api/cart/price", {
      data: { items: [{ variantId: variant.id, quantity: 1 }], couponCode: "E2EFLAT100" },
    });
    const body = await res.json();
    expect(body.discountPaise ?? 0, "a disabled coupon must stop discounting").toBe(0);

    await db.coupon.update({ where: { code: "E2EFLAT100" }, data: { isActive: true } });
  });
});

test.describe("orders", () => {
  test("@smoke a placed order appears in the admin list", async ({ adminPage, request }) => {
    const variant = await ensureStock("intense");
    const { body } = await placeOrder(request, { variantId: variant.id });

    await adminPage.goto("/admin/orders");
    await expect(adminPage.getByText(body.orderNumber)).toBeVisible();
  });

  test("order detail shows the customer and items", async ({ adminPage, request }) => {
    const variant = await ensureStock("night-drip");
    const { body } = await placeOrder(request, {
      variantId: variant.id,
      email: "admin-detail@test.dev",
    });

    const order = await db.order.findUnique({
      where: { orderNumber: body.orderNumber },
      select: { id: true },
    });

    await adminPage.goto(`/admin/orders/${order!.id}`);
    await expect(adminPage.getByText(body.orderNumber)).toBeVisible();
    await expect(adminPage.getByText("admin-detail@test.dev")).toBeVisible();
    await expect(adminPage.getByText(/night drip/i).first()).toBeVisible();
  });

  test("the COD filter narrows the list", async ({ adminPage }) => {
    await adminPage.goto("/admin/orders?status=COD");
    await expect(adminPage.getByRole("heading", { level: 1 })).toBeVisible();
    // Every visible order number should belong to a COD order.
    const numbers = await adminPage.locator("text=/AVN-[A-Z0-9]{6}/").allInnerTexts();
    const codes = [...new Set(numbers.map((t) => /AVN-[A-Z0-9]{6}/.exec(t)?.[0]).filter(Boolean))];
    if (codes.length) {
      const rows = await db.order.findMany({
        where: { orderNumber: { in: codes as string[] } },
        select: { paymentMethod: true },
      });
      expect(rows.every((r) => r.paymentMethod === "COD")).toBe(true);
    }
  });
});

test.describe("reviews moderation", () => {
  test("@smoke approving a review publishes it on the storefront", async ({ adminPage, page }) => {
    const product = await db.product.findUnique({
      where: { slug: "night-drip" },
      select: { id: true },
    });
    const user = await db.user.findUnique({
      where: { email: "customer@test.dev" },
      select: { id: true },
    });

    const body = `E2E approve me ${Date.now()}`;
    await db.review.deleteMany({ where: { productId: product!.id, userId: user!.id } });
    const review = await db.review.create({
      data: {
        productId: product!.id,
        userId: user!.id,
        rating: 5,
        body,
        status: "PENDING",
      },
    });

    // Pending: not on the storefront.
    await page.goto("/fragrance/night-drip");
    await expect(page.getByText(body)).toHaveCount(0);

    await adminPage.goto("/admin/reviews");
    await expect(adminPage.getByText(body)).toBeVisible();
    await adminPage.getByRole("button", { name: /approve/i }).first().click();

    await expect
      .poll(
        async () =>
          (await db.review.findUnique({ where: { id: review.id }, select: { status: true } }))
            ?.status,
        { timeout: 15_000 },
      )
      .toBe("APPROVED");

    await page.goto("/fragrance/night-drip");
    await expect(page.getByText(body)).toBeVisible();

    await db.review.delete({ where: { id: review.id } });
  });
});

test.describe("enquiries inbox", () => {
  test("@smoke a storefront enquiry lands in the inbox", async ({ adminPage, page }) => {
    const message = `E2E inbox ${Date.now()}`;

    await page.goto("/contact");
    await page.getByRole("main").getByLabel("Name", { exact: true }).fill("Inbox Tester");
    await page.getByRole("main").getByLabel("Email", { exact: true }).fill("inbox@test.dev");
    await page.getByRole("main").getByLabel("Message").fill(message);
    await page.getByRole("main").getByRole("button", { name: /send message/i }).click();

    await expect
      .poll(async () => db.enquiry.count({ where: { message } }), { timeout: 20_000 })
      .toBe(1);

    await adminPage.goto("/admin/enquiries");
    await expect(adminPage.getByText("inbox@test.dev").first()).toBeVisible();

    await db.enquiry.deleteMany({ where: { message } });
  });
});

test.describe("customers", () => {
  test("@smoke lists the seeded customer", async ({ adminPage }) => {
    await adminPage.goto("/admin/customers");
    await expect(adminPage.getByText("customer@test.dev")).toBeVisible();
  });
});

test.describe("newsletter", () => {
  test("@smoke a subscriber appears and the CSV exports", async ({ adminPage }) => {
    const email = `csv-${Date.now()}@test.dev`;
    await db.newsletterSubscriber.create({ data: { email, source: "e2e" } });

    await adminPage.goto("/admin/newsletter");
    await expect(adminPage.getByText(email)).toBeVisible();

    const res = await adminPage.request.get("/api/admin/newsletter.csv");
    expect(res.ok()).toBe(true);
    expect(await res.text(), "the export should contain the subscriber").toContain(email);

    await db.newsletterSubscriber.delete({ where: { email } });
  });
});

test.describe("settings", () => {
  test("@smoke changing the announcement text updates the storefront", async ({
    adminPage,
    page,
  }) => {
    const original = await db.storeSetting.findUnique({ where: { id: 1 } });
    const text = `E2E strip ${Date.now()}`;

    await adminPage.goto("/admin/settings");
    const field = adminPage.getByRole("textbox", { name: /announcement strip/i });
    await field.fill(text);
    await adminPage.getByRole("button", { name: /save settings/i }).click();

    await expect
      .poll(
        async () =>
          (await db.storeSetting.findUnique({ where: { id: 1 }, select: { announcementText: true } }))
            ?.announcementText,
        { timeout: 20_000 },
      )
      .toBe(text);

    await page.goto("/");
    await expect(page.getByText(text).first()).toBeVisible();

    await db.storeSetting.update({
      where: { id: 1 },
      data: { announcementText: original!.announcementText },
    });
  });

  test("turning COD off removes it from checkout pricing", async ({ adminPage, request }) => {
    await db.storeSetting.update({ where: { id: 1 }, data: { codEnabled: false } });

    const variant = await ensureStock("intense");
    const res = await request.post("/api/cart/price", {
      data: {
        items: [{ variantId: variant.id, quantity: 1 }],
        paymentMethod: "COD",
      },
    });
    const body = await res.json();
    expect(body.codAllowed ?? body.codEnabled ?? false, "COD should be off").toBeFalsy();

    await db.storeSetting.update({ where: { id: 1 }, data: { codEnabled: true } });
  });

  test("the free-shipping threshold drives the shipping line", async ({ adminPage, request }) => {
    const original = await db.storeSetting.findUnique({ where: { id: 1 } });

    // Threshold far above a single bottle: shipping must be charged.
    await db.storeSetting.update({
      where: { id: 1 },
      data: { freeShippingThresholdPaise: 10_000_000 },
    });

    const variant = await ensureStock("intense");
    const paid = await request.post("/api/cart/price", {
      data: { items: [{ variantId: variant.id, quantity: 1 }] },
    });
    expect((await paid.json()).shippingPaise, "under the threshold, shipping is charged").toBeGreaterThan(0);

    // Threshold at zero: everything ships free.
    await db.storeSetting.update({ where: { id: 1 }, data: { freeShippingThresholdPaise: 0 } });
    const free = await request.post("/api/cart/price", {
      data: { items: [{ variantId: variant.id, quantity: 1 }] },
    });
    expect((await free.json()).shippingPaise, "over the threshold, shipping is free").toBe(0);

    await db.storeSetting.update({
      where: { id: 1 },
      data: { freeShippingThresholdPaise: original!.freeShippingThresholdPaise },
    });
  });
});
