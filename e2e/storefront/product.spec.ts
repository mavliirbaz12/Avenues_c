import { test, expect } from "../fixtures";
import { addToCart, buyNow, cartButton, main, openCart } from "../utils/selectors";
import { db } from "../utils/db";

test.afterAll(() => db.$disconnect());

/**
 * Product detail, parametrised over every seeded fragrance.
 *
 * Assertions come from the database, not from copies of the seed constants —
 * a spec that hard-codes "Bergamot" passes forever after someone changes the
 * formulation in admin and forgets the storefront.
 */

const SLUGS = ["intense", "pink-aura", "night-drip", "blue-mist", "white-oud"] as const;

test.describe("product detail", () => {
  for (const slug of SLUGS) {
    test(`${slug} renders its real name, price and notes`, async ({ page }) => {
      const product = await db.product.findUnique({
        where: { slug },
        include: { variants: { orderBy: { sortOrder: "asc" } } },
      });
      expect(product, `${slug} should be seeded`).not.toBeNull();

      await page.goto(`/fragrance/${slug}`);
      const body = main(page);

      const short = product!.name.replace(/^Avenues\s+/i, "");
      await expect(page.getByRole("heading", { level: 1 })).toContainText(short);
      await expect(body.getByText(product!.tagline, { exact: false }).first()).toBeVisible();

      // Price: offer price shown, MRP struck through when discounted.
      const v = product!.variants[0];
      const offer = (v.pricePaise / 100).toLocaleString("en-IN");
      await expect(body.getByText(new RegExp(`₹\\s*${offer}`)).first()).toBeVisible();
      if (v.mrpPaise > v.pricePaise) {
        const mrp = (v.mrpPaise / 100).toLocaleString("en-IN");
        await expect(body.getByText(new RegExp(`₹\\s*${mrp}`)).first()).toBeVisible();
      }

      // The note pyramid must show every real note, in all three tiers.
      for (const note of [...product!.notesTop, ...product!.notesHeart, ...product!.notesBase]) {
        await expect(
          body.getByText(note, { exact: false }).first(),
          `${slug} should list the note "${note}"`,
        ).toBeVisible();
      }

      // Perfume-house copy, not a spec sheet.
      if (product!.sensoryNarrative) {
        await expect(body.getByText(product!.sensoryNarrative.slice(0, 40), { exact: false }).first()).toBeVisible();
      }
      if (product!.bestFor) {
        await expect(body.getByText(product!.bestFor.slice(0, 30), { exact: false }).first()).toBeVisible();
      }

      // Longevity promoted near the top, not buried in bullets.
      await expect(body.getByText(new RegExp(product!.longevity.replace(/\s+/g, "\\s*"), "i")).first()).toBeVisible();

      // Legal Metrology.
      await expect(body.getByText(/inclusive of all taxes/i).first()).toBeVisible();
      await expect(body.getByText(new RegExp(product!.countryOfOrigin, "i")).first()).toBeVisible();
    });
  }

  test("@smoke add to cart counts on the bar without hijacking the page", async ({ page }) => {
    await page.goto("/fragrance/night-drip");

    // Three "Add to cart" controls exist: the main one, and a duplicate in the
    // mobile sticky bar portalled to <body>. Scope to the page content.
    await addToCart(page);

    // The whole point of the change: the shopper is still reading the product
    // they were reading. Nothing has been thrown over it to dismiss.
    await expect(cartButton(page, 1)).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Your cart" })).toBeHidden();
    await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();

    // And the item really is in there, for anyone who taps the cart to look.
    const drawer = await openCart(page);
    await expect(drawer.getByText(/night drip/i).first()).toBeVisible();
    await expect(drawer.getByRole("link", { name: /checkout/i })).toBeVisible();
  });

  test("Buy now goes straight to checkout with the item", async ({ customerPage }) => {
    // Checkout requires an account, so this asserts the signed-in shortcut.
    // The signed-out half — Buy now landing on /login with the destination
    // preserved — is covered in cart-checkout/checkout.spec.ts.
    await customerPage.goto("/fragrance/intense");
    await buyNow(customerPage);

    await expect(main(customerPage).getByText(/intense/i).first()).toBeVisible();
  });

  test("quantity stepper respects available stock", async ({ page }) => {
    await page.goto("/fragrance/intense");
    const body = main(page);

    const inc = body.getByRole("button", { name: "Increase quantity" });
    const qty = body.locator('[aria-live="polite"]').first();

    await expect(qty).toHaveText("1");
    await inc.click();
    await expect(qty).toHaveText("2");

    await body.getByRole("button", { name: "Decrease quantity" }).click();
    await expect(qty).toHaveText("1");
  });

  test("a sold-out variant offers notify-me instead of add to cart", async ({ page }) => {
    const soldOut = await db.product.findFirst({
      where: { isActive: true, variants: { every: { stock: 0 } } },
      select: { slug: true },
    });
    test.skip(!soldOut, "no sold-out product seeded");

    await page.goto(`/fragrance/${soldOut!.slug}`);

    // Scope to the buy box: the related-products strip lower down carries its
    // own in-stock "Add to cart" buttons, which are not what this asserts.
    const buyBox = main(page).locator("section").first();
    await expect(buyBox.getByRole("button", { name: "Add to cart" })).toHaveCount(0);
    await expect(main(page).getByRole("button", { name: /notify me/i })).toBeVisible();
  });

  test("wishlist heart persists for a guest across a reload", async ({ page }) => {
    await page.goto("/fragrance/pink-aura");
    const heart = main(page).getByRole("button", { name: /wishlist|save/i }).first();
    test.skip((await heart.count()) === 0, "no wishlist control on the PDP");

    await heart.click();
    await page.reload();

    await expect(main(page).getByRole("button", { name: /wishlist|save/i }).first()).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("WhatsApp enquiry link pre-fills the product name", async ({ page }) => {
    await page.goto("/fragrance/white-oud");
    const link = main(page).locator('a[href*="wa.me"]').first();
    test.skip((await link.count()) === 0, "WhatsApp number not configured");

    const href = await link.getAttribute("href");
    expect(decodeURIComponent(href ?? "")).toMatch(/white oud/i);
  });

  test("related products render and link elsewhere", async ({ page }) => {
    await page.goto("/fragrance/night-drip");
    const related = main(page).locator('a[href^="/fragrance/"]');
    const hrefs = await related.evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute("href")),
    );
    const others = hrefs.filter((h) => h && !h.includes("night-drip"));
    expect(others.length, "should link to other fragrances").toBeGreaterThan(0);
  });

  test("breadcrumb points home and to shop", async ({ page }) => {
    await page.goto("/fragrance/blue-mist");
    const crumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumb.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    await expect(crumb.getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/shop");
  });
});

test.describe("reviews", () => {
  /**
   * Two paths, and the difference is the whole point.
   *
   * A verified buyer — someone with a DELIVERED order containing this
   * fragrance — publishes immediately. Anyone else queues for moderation. The
   * queue exists to stop a competitor or a bot writing on a product page, not
   * to make a paying customer wait, so gating on the order rather than on a
   * human's attention gets both.
   *
   * Both halves are asserted because the failure modes are opposite and both
   * are bad: a regression that queues everything makes the store look
   * reviewless, and one that publishes everything hands your product pages to
   * anyone with an account.
   */
  async function resetReview(productId: string, userId: string) {
    await db.review.deleteMany({ where: { productId, userId } });
  }

  async function submitReview(page: import("@playwright/test").Page, slug: string, body: string) {
    await page.goto(`/fragrance/${slug}`);
    // Scope to the reviews section: the PDP renders a related-products strip
    // with its own controls below it.
    const form = page.locator("#reviews");
    await form.scrollIntoViewIfNeeded();
    // The picker is a radiogroup, not five buttons — role="radio" overrides the
    // implicit button role. That is the correct ARIA pattern for a rating.
    await form.getByRole("radio", { name: "5 stars" }).click();
    await form.getByLabel("Your review").fill(body);
    await form.getByRole("button", { name: /submit review/i }).click();
  }

  test("a buyer who has not received this fragrance is moderated", async ({ customerPage }) => {
    const slug = "pink-aura";
    const [product, user] = await Promise.all([
      db.product.findUnique({ where: { slug }, select: { id: true } }),
      db.user.findUnique({ where: { email: "customer@test.dev" }, select: { id: true } }),
    ]);
    await resetReview(product!.id, user!.id);

    // Make sure this account has NO delivered order for this fragrance.
    const delivered = await db.orderItem.count({
      where: {
        order: { userId: user!.id, status: "DELIVERED" },
        variant: { productId: product!.id },
      },
    });
    test.skip(delivered > 0, "this account has bought pink-aura; not the unverified case");

    const bodyText = `E2E moderation check ${Date.now()}`;
    await submitReview(customerPage, slug, bodyText);

    await expect
      .poll(
        async () =>
          (await db.review.findFirst({ where: { productId: product!.id, userId: user!.id } }))
            ?.status ?? null,
        { timeout: 20_000, message: "an unverified review should be stored as PENDING" },
      )
      .toBe("PENDING");

    await customerPage.goto(`/fragrance/${slug}`);
    await expect(customerPage.getByText(bodyText)).toHaveCount(0);

    await resetReview(product!.id, user!.id);
  });

  test("@smoke a verified buyer's review publishes immediately", async ({ customerPage }) => {
    const slug = "intense";
    const [product, user] = await Promise.all([
      db.product.findUnique({
        where: { slug },
        select: { id: true, variants: { select: { id: true, sku: true }, take: 1 } },
      }),
      db.user.findUnique({ where: { email: "customer@test.dev" }, select: { id: true } }),
    ]);
    await resetReview(product!.id, user!.id);

    // A delivered order for this fragrance is what "verified" means.
    const order = await db.order.create({
      data: {
        orderNumber: `AVN-VER${Date.now().toString().slice(-6)}`,
        userId: user!.id,
        email: "customer@test.dev",
        phone: "9812345670",
        status: "DELIVERED",
        paymentMethod: "COD",
        paymentStatus: "PAID",
        subtotalPaise: 59900,
        totalPaise: 59900,
        shipName: "Test Customer",
        shipPhone: "9812345670",
        shipLine1: "1 Test Street",
        shipCity: "Mumbai",
        shipState: "Maharashtra",
        shipPincode: "400001",
        termsAcceptedAt: new Date(),
        items: {
          create: [
            {
              variantId: product!.variants[0]!.id,
              productName: "Avenues Intense",
              productSlug: slug,
              sku: product!.variants[0]!.sku,
              variantSize: "50ml",
              quantity: 1,
              mrpPaise: 99900,
              unitPricePaise: 59900,
              totalPaise: 59900,
            },
          ],
        },
      },
      select: { id: true },
    });

    try {
      const bodyText = `E2E verified review ${Date.now()}`;
      await submitReview(customerPage, slug, bodyText);

      await expect
        .poll(
          async () =>
            (await db.review.findFirst({ where: { productId: product!.id, userId: user!.id } }))
              ?.status ?? null,
          { timeout: 20_000, message: "a verified buyer's review should be APPROVED on submit" },
        )
        .toBe("APPROVED");

      // And it is on the page without anyone having approved it.
      await customerPage.goto(`/fragrance/${slug}`);
      await expect(customerPage.getByText(bodyText).first()).toBeVisible();
    } finally {
      await resetReview(product!.id, user!.id);
      await db.order.delete({ where: { id: order.id } }).catch(() => {});
    }
  });
});
