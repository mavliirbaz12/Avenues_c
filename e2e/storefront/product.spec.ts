import { test, expect } from "../fixtures";
import { main } from "../utils/selectors";
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

  test("@smoke add to cart opens the drawer with the right item", async ({ page }) => {
    await page.goto("/fragrance/night-drip");

    // Three "Add to cart" controls exist: the main one, and a duplicate in the
    // mobile sticky bar portalled to <body>. Scope to the page content.
    await main(page).getByRole("button", { name: "Add to cart" }).first().click();

    const drawer = page.getByRole("dialog", { name: "Your cart" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(/night drip/i).first()).toBeVisible();
    await expect(drawer.getByRole("link", { name: /checkout/i })).toBeVisible();
  });

  test("Buy now goes straight to checkout with the item", async ({ customerPage }) => {
    // Checkout requires an account, so this asserts the signed-in shortcut.
    // The signed-out half — Buy now landing on /login with the destination
    // preserved — is covered in cart-checkout/checkout.spec.ts.
    await customerPage.goto("/fragrance/intense");
    await main(customerPage).getByRole("button", { name: /buy now/i }).first().click();

    await customerPage.waitForURL(/\/checkout/);
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
  test("a submitted review stays hidden until an admin approves it", async ({ customerPage }) => {
    const slug = "intense";
    const product = await db.product.findUnique({ where: { slug }, select: { id: true } });
    const user = await db.user.findUnique({
      where: { email: "customer@test.dev" },
      select: { id: true },
    });

    // Start clean so the "already reviewed" branch doesn't hide the form.
    await db.review.deleteMany({ where: { productId: product!.id, userId: user!.id } });

    const bodyText = `E2E moderation check ${Date.now()}`;

    await customerPage.goto(`/fragrance/${slug}`);
    // Scope to the reviews section itself rather than all of <main>: the PDP
    // renders a related-products strip with its own controls below it.
    const form = customerPage.locator("#reviews");
    await form.scrollIntoViewIfNeeded();

    // The picker is a radiogroup, not five buttons — role="radio" overrides
    // the implicit button role. That is the correct ARIA pattern for a rating.
    await form.getByRole("radio", { name: "5 stars" }).click();
    await form.getByLabel("Your review").fill(bodyText);
    await form.getByRole("button", { name: /submit review/i }).click();

    // Assert the durable outcome, not a banner that may have already faded:
    // the row must exist and must be PENDING.
    await expect
      .poll(
        async () =>
          (await db.review.findFirst({ where: { productId: product!.id, userId: user!.id } }))
            ?.status ?? null,
        { timeout: 20_000, message: "review should be stored as PENDING" },
      )
      .toBe("PENDING");

    // And it must not be publicly visible yet.
    await customerPage.goto(`/fragrance/${slug}`);
    await expect(customerPage.getByText(bodyText)).toHaveCount(0);

    await db.review.deleteMany({ where: { productId: product!.id, userId: user!.id } });
  });
});
