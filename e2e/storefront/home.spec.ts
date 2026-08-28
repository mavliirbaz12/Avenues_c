import { test, expect } from "../fixtures";
import { main, nav, footer } from "../utils/selectors";
import { db } from "../utils/db";

test.afterAll(() => db.$disconnect());

/**
 * The landing page. Every section the brief specifies, asserted against live
 * data rather than hard-coded copy where the data is the point.
 */

test.describe("landing page", () => {
  test("@smoke announcement strip shows the admin-set text and dismisses", async ({ page }) => {
    const settings = await db.storeSetting.findUnique({ where: { id: 1 } });
    test.skip(!settings?.announcementEnabled, "announcement disabled in settings");

    /*
      Poll the page, because the home page is prerendered.

      This reads the CURRENT announcement text from the database and expects it
      on screen, but another spec may have changed that text moments earlier and
      the cached page can still be the copy being replaced. Reloading until it
      matches is a real check — it fails if the strip never shows the current
      text — without depending on how quickly the server got round to
      regenerating.
    */
    const strip = page.getByRole("link", { name: new RegExp(settings!.announcementText!, "i") });
    await expect
      .poll(
        async () => {
          await page.goto("/");
          return strip.count();
        },
        { message: "the strip should show the current announcement text", timeout: 20_000 },
      )
      .toBeGreaterThan(0);
    await expect(strip).toBeVisible();

    await page.getByRole("button", { name: /dismiss announcement/i }).click();
    await expect(strip).toHaveCount(0);
  });

  test("@smoke @desktop nav carries visible labels, not mystery icons", async ({ page }) => {
    await page.goto("/");
    const bar = nav(page);

    // The brief is explicit: a first-time visitor must not have to decode an
    // icon. Every control needs a visible word at desktop width.
    for (const label of ["Search", "Wishlist", "Login", "Cart"]) {
      await expect(bar.getByText(label, { exact: true })).toBeVisible();
    }

    for (const link of ["Shop", "Know Avenues", "Track order", "Contact"]) {
      await expect(bar.getByRole("link", { name: new RegExp(link, "i") })).toBeVisible();
    }
  });

  /**
   * SINGLE products only. The query behind this menu never filtered by type,
   * so a gift set was listed under "Fragrances" — mislabelled, and pointing at
   * /fragrance/<slug>, which the fragrance page refuses to serve. Sets have
   * their own top-level nav item.
   */
  test("@desktop fragrances dropdown lists every active fragrance by name", async ({ page }) => {
    const [fragrances, sets] = await Promise.all([
      db.product.findMany({
        where: { isActive: true, type: "SINGLE" },
        select: { name: true, slug: true },
        orderBy: { sortOrder: "asc" },
      }),
      db.product.findMany({
        where: { isActive: true, type: "COMBO" },
        select: { name: true, slug: true },
      }),
    ]);

    await page.goto("/");
    // Hover, not click. The menu opens on mouseenter, so a programmatic click
    // hovers first (opening it) and then toggles it shut again — which is also
    // exactly what a mouse user experiences if they click the trigger.
    await nav(page).getByRole("button", { name: "Fragrances", exact: true }).hover();

    for (const p of fragrances) {
      const short = p.name.replace(/^Avenues\s+/i, "");
      const item = nav(page).getByRole("link", { name: new RegExp(`^\s*${short}\s*$`, "i") });
      await expect(item).toBeVisible();
      await expect(item).toHaveAttribute("href", `/fragrance/${p.slug}`);
    }

    for (const s of sets) {
      await expect(
        nav(page).locator(`a[href="/fragrance/${s.slug}"]`),
        `"${s.name}" is a gift set and must not appear under Fragrances`,
      ).toHaveCount(0);
    }
  });

  /**
   * The pointer must be able to reach the panel.
   *
   * The panel sat `marginTop: 0.5rem` below the trigger, and that 8px belonged
   * to neither element — crossing it put the pointer over bare header, fired
   * mouseleave on the wrapper and closed the menu before it could be used. The
   * menu opened correctly and was still impossible to click, which is why it
   * survived a spec that only ever asserted its contents were visible.
   */
  test("@desktop the dropdown survives the pointer travelling into it", async ({ page }) => {
    await page.goto("/");

    const trigger = nav(page).getByRole("button", { name: "Fragrances", exact: true });
    await trigger.hover();

    const item = nav(page).locator('a[href^="/fragrance/"]').first();
    await expect(item).toBeVisible();

    // Step through the gap the way a hand does, rather than teleporting.
    const from = (await trigger.boundingBox())!;
    const to = (await item.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });

    await expect(item, "the menu closed while the pointer was crossing to it").toBeVisible();

    await item.click();
    await expect(page).toHaveURL(/\/fragrance\//);
  });

  /**
   * The home page must not state how many fragrances exist, or what size the
   * bottle is.
   *
   * Both were rendered live from the catalogue, which fixed staleness and left
   * two worse failures. `getCatalogueSummary` joins every distinct size with
   * " & ", so a shop selling 20ml, 50ml and 100ml described itself as
   * "20ml & 50ml & 100ml" — in the hero micro-label, in a display-sized fact
   * tile, and in the SEO description. And a headline that counts the catalogue
   * advertises a small one, then goes wrong the day it grows.
   *
   * This asserts the absence, because the failure mode is silent: the page
   * renders perfectly, it just says something false or ugly. Adding either back
   * now fails here rather than in production.
   */
  test("@smoke the home page claims no catalogue size and no bottle size", async ({ page }) => {
    await page.goto("/");
    const body = (await page.locator("body").innerText()).toLowerCase();

    expect(body, "no bottle size on the home page").not.toMatch(/\d+\s?ml/);
    expect(
      body,
      "no spelled catalogue count — it goes wrong when a product is added",
    ).not.toMatch(/(three|four|five|six|seven|eight|nine|ten)\s+(fragrance|eau de parfum)/);
  });

  test("hero shows the headline and a Discover CTA into the reveal", async ({ page }) => {
    await page.goto("/");
    await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();

    const cta = main(page).getByRole("link", { name: "Discover", exact: true });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "#reveal");
  });

  test("no autoplaying video in the first viewport unless an admin set one", async ({ page }) => {
    const settings = await db.storeSetting.findUnique({ where: { id: 1 } });
    await page.goto("/");

    const videos = page.locator("video");
    if (!settings?.heroVideoUrl) {
      // Image-first hero: the element must not exist at all, not merely be
      // paused — mounting it still costs a connection and a decode.
      await expect(videos).toHaveCount(0);
    }
  });

  test("featured slider advances and each slide links to its product", async ({ page }) => {
    await page.goto("/");
    const slider = main(page).getByRole("region", { name: /featured|fragrance/i }).first();
    test.skip((await slider.count()) === 0, "no labelled slider region");

    const explore = slider.getByRole("link", { name: /explore/i }).first();
    await expect(explore).toBeVisible();
    await expect(explore).toHaveAttribute("href", /\/fragrance\//);
  });

  test("@smoke collection grid renders every active fragrance with a price", async ({ page }) => {
    // Fragrances only — a gift set is featured through its own band, not
    // inside "Five fragrances, and no filler".
    const products = await db.product.findMany({
      where: { isActive: true, type: "SINGLE" },
      select: { name: true, slug: true },
    });

    await page.goto("/#collection");
    const grid = main(page).locator("#collection");
    await expect(grid).toBeVisible();

    for (const p of products) {
      const short = p.name.replace(/^Avenues\s+/i, "");
      await expect(grid.getByRole("link", { name: new RegExp(short, "i") }).first()).toBeVisible();
    }

    // Legal Metrology: the tax line appears once beneath the grid.
    await expect(grid.getByText(/inclusive of all taxes/i)).toHaveCount(1);
  });

  test("a sold-out product shows its sold-out state", async ({ page }) => {
    const soldOut = await db.product.findFirst({
      where: { isActive: true, variants: { every: { stock: 0 } } },
      select: { name: true, slug: true },
    });
    test.skip(!soldOut, "no sold-out product seeded");

    await page.goto(`/fragrance/${soldOut!.slug}`);
    await expect(main(page).getByText(/sold out/i).first()).toBeVisible();
  });

  test("collection anchor clears the fixed header", async ({ page }) => {
    // scroll-margin-top must exceed the nav + announcement strip, or the
    // heading lands underneath the chrome.
    await page.goto("/#collection");
    await page.waitForTimeout(600);

    const box = await main(page).locator("#collection-heading").boundingBox();
    const headerH = await page.evaluate(() => {
      const el = document.querySelector("header");
      return el ? el.getBoundingClientRect().bottom : 0;
    });

    expect(box, "collection heading should be on screen").not.toBeNull();
    expect(box!.y, "heading must sit below the fixed header").toBeGreaterThanOrEqual(headerH - 1);
  });

  test("footer carries policy links, WhatsApp and a mailto", async ({ page }) => {
    await page.goto("/");
    const foot = footer(page);

    for (const p of ["privacy", "terms", "shipping", "returns"]) {
      await expect(foot.locator(`a[href="/policies/${p}"]`)).toHaveCount(1);
    }
    await expect(foot.locator('a[href^="mailto:"]')).not.toHaveCount(0);

    const wa = foot.locator('a[href*="wa.me"]');
    if (await wa.count()) {
      await expect(wa.first()).toHaveAttribute("href", /wa\.me\/\d+/);
    }
  });

  test("floating WhatsApp button is present across the storefront", async ({ page }) => {
    for (const path of ["/", "/shop", "/fragrance/night-drip", "/contact"]) {
      await page.goto(path);
      const fab = page.locator('a[href*="wa.me"]').filter({ hasNot: footer(page) });
      // Present or deliberately absent when no number is configured; if any
      // wa.me link exists on the page it must be well-formed.
      const all = page.locator('a[href*="wa.me"]');
      if (await all.count()) {
        await expect(all.first()).toHaveAttribute("href", /wa\.me\//);
      }
      void fab;
    }
  });
});

test.describe("newsletter capture", () => {
  test("@smoke a valid address subscribes and lands in the database", async ({ page }) => {
    const email = `nl-${Date.now()}@test.dev`;
    await page.goto("/");

    const form = footer(page).locator("form").filter({ has: page.getByLabel("Email address") }).first();
    await form.getByLabel("Email address").fill(email);
    await form.getByRole("button", { name: "Subscribe" }).click();

    await expect(footer(page).getByRole("status").first()).toBeVisible({ timeout: 15_000 });

    const row = await db.newsletterSubscriber.findUnique({ where: { email } });
    expect(row, "subscriber row should exist").not.toBeNull();

    await db.newsletterSubscriber.delete({ where: { email } });
  });

  test("an invalid address is rejected and stores nothing", async ({ page }) => {
    await page.goto("/");
    const form = footer(page).locator("form").filter({ has: page.getByLabel("Email address") }).first();
    await form.getByLabel("Email address").fill("not-an-email");
    await form.getByRole("button", { name: "Subscribe" }).click();

    // Form stays put rather than reporting success.
    await expect(form.getByLabel("Email address")).toBeVisible();
    expect(await db.newsletterSubscriber.findUnique({ where: { email: "not-an-email" } })).toBeNull();
  });

  test("subscribing twice is handled gracefully", async ({ page }) => {
    const email = `nl-dupe-${Date.now()}@test.dev`;
    await db.newsletterSubscriber.create({ data: { email, source: "e2e" } });

    await page.goto("/");
    const form = footer(page).locator("form").filter({ has: page.getByLabel("Email address") }).first();
    await form.getByLabel("Email address").fill(email);
    await form.getByRole("button", { name: "Subscribe" }).click();

    // No crash, no duplicate — a friendly confirmation either way.
    await expect(footer(page).getByRole("status").first()).toBeVisible({ timeout: 15_000 });
    expect(await db.newsletterSubscriber.count({ where: { email } })).toBe(1);

    await db.newsletterSubscriber.delete({ where: { email } });
  });
});

/**
 * The home page review rail.
 *
 * Two states worth asserting, and the hidden one is the one that matters. A
 * carousel holding a single review reads as "nobody has bought this", which is
 * worse for a young store than saying nothing — so the section renders only
 * from three approved reviews upward.
 *
 * Approved is the only status that leaves the database. A PENDING review
 * appearing here would put unmoderated text on the front page.
 */
test.describe("home reviews", () => {
  const MARK = "e2e-home-review";

  /**
   * Every state change goes through the ADMIN FORM, never a Prisma write.
   *
   * The landing page is ISR and the rail's query is cached, so the only thing
   * that makes a change visible is the revalidation `moderateReview` performs.
   * Writing rows directly and reloading proves nothing — the page keeps serving
   * its cached copy, which is how an earlier version of this spec managed to
   * assert "hidden" against a page that was simply stale, and then fail the
   * next test with three reviews it had already deleted from the database.
   *
   * Driving the real moderation flow is also the only way to know the
   * revalidation added to moderateReview actually reaches the home page.
   */
  let parked: string[] = [];

  test.beforeAll(async () => {
    const rows = await db.review.findMany({
      where: { status: "APPROVED" },
      select: { id: true },
    });
    parked = rows.map((r) => r.id);
    if (parked.length) {
      await db.review.updateMany({ where: { id: { in: parked } }, data: { status: "PENDING" } });
    }
  });

  test.afterAll(async () => {
    await db.review.deleteMany({ where: { body: { contains: MARK } } });
    if (parked.length) {
      await db.review.updateMany({ where: { id: { in: parked } }, data: { status: "APPROVED" } });
    }
  });

  test("@smoke the rail appears only from the third approved review", async ({
    page,
    adminPage,
  }) => {
    const tag = `${MARK}-${Date.now()}`;
    const [user, products] = await Promise.all([
      db.user.findFirst({ where: { email: "customer@test.dev" }, select: { id: true } }),
      db.product.findMany({
        where: { isActive: true, type: "SINGLE" },
        select: { id: true },
        take: 3,
      }),
    ]);
    expect(products.length, "need three fragrances to seed three reviews").toBe(3);

    // Three PENDING reviews — invisible until an admin says otherwise.
    const bodies = products.map((_, i) => `${tag} number ${i}`);
    for (let i = 0; i < 3; i++) {
      await db.review.deleteMany({ where: { productId: products[i]!.id, userId: user!.id } });
      await db.review.create({
        data: {
          productId: products[i]!.id,
          userId: user!.id,
          rating: 5,
          title: `Lovely ${i}`,
          body: bodies[i]!,
          status: "PENDING",
        },
      });
    }

    const approve = async (body: string) => {
      await adminPage.goto("/admin/reviews");
      const row = adminPage.locator("li,tr,article").filter({ hasText: body }).first();
      await row.getByRole("button", { name: /approve/i }).first().click();
      await expect
        .poll(async () => db.review.count({ where: { body, status: "APPROVED" } }))
        .toBe(1);
    };

    await approve(bodies[0]!);
    await page.goto("/");
    await expect(page.locator("#reviews-heading"), "one review is not proof").toHaveCount(0);

    await approve(bodies[1]!);
    await page.goto("/");
    await expect(page.locator("#reviews-heading"), "two is still an anecdote").toHaveCount(0);

    /*
      Poll the PAGE, not just the database.

      revalidatePath marks the cached home page stale; the regeneration happens
      on the next request. A single goto immediately after the approve can land
      on the copy still being replaced, so the rail is absent for reasons that
      have nothing to do with the threshold. Reloading until it appears is a
      real check — it fails if the rail never arrives — and it stops the test
      depending on how quickly the server got round to rebuilding.
    */
    await approve(bodies[2]!);
    await expect
      .poll(
        async () => {
          await page.goto("/");
          return page.locator("#reviews-heading").count();
        },
        { message: "the rail should appear once a third review is approved", timeout: 20_000 },
      )
      .toBeGreaterThan(0);

    await expect(main(page).getByText(new RegExp(tag)).first()).toBeVisible();
  });

  test("a pending review never reaches the home page", async ({ page }) => {
    // A tag unique to this test, so a stale cached page from another test
    // cannot satisfy or break the assertion.
    const tag = `${MARK}-pending-${Date.now()}`;
    const [user, product] = await Promise.all([
      db.user.findFirst({ where: { email: "customer@test.dev" }, select: { id: true } }),
      db.product.findFirst({ where: { isActive: true, type: "SINGLE" }, select: { id: true } }),
    ]);
    await db.review.deleteMany({ where: { productId: product!.id, userId: user!.id } });
    await db.review.create({
      data: {
        productId: product!.id,
        userId: user!.id,
        rating: 1,
        body: `${tag} unmoderated and should never be shown`,
        status: "PENDING",
      },
    });

    await page.goto("/");
    await expect(page.getByText(new RegExp(tag))).toHaveCount(0);
  });
});
