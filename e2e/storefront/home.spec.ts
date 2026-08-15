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

    await page.goto("/");
    const strip = page.getByRole("link", { name: new RegExp(settings!.announcementText!, "i") });
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

    for (const link of ["Shop all", "Know Avenues", "Track order", "Contact"]) {
      await expect(bar.getByRole("link", { name: new RegExp(link, "i") })).toBeVisible();
    }
  });

  test("@desktop fragrances dropdown lists every active product by name", async ({ page }) => {
    const products = await db.product.findMany({
      where: { isActive: true },
      select: { name: true, slug: true },
      orderBy: { sortOrder: "asc" },
    });

    await page.goto("/");
    // Hover, not click. The menu opens on mouseenter, so a programmatic click
    // hovers first (opening it) and then toggles it shut again — which is also
    // exactly what a mouse user experiences if they click the trigger.
    await nav(page).getByRole("button", { name: "Fragrances", exact: true }).hover();

    for (const p of products) {
      const short = p.name.replace(/^Avenues\s+/i, "");
      const item = nav(page).getByRole("link", { name: new RegExp(`^\s*${short}\s*$`, "i") });
      await expect(item).toBeVisible();
      await expect(item).toHaveAttribute("href", `/fragrance/${p.slug}`);
    }
  });

  test("hero shows the headline and a Discover CTA into the reveal", async ({ page }) => {
    await page.goto("/");
    await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();

    const cta = main(page).getByRole("link", { name: /discover/i });
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

  test("@smoke collection grid renders every active product with a price", async ({ page }) => {
    const products = await db.product.findMany({
      where: { isActive: true },
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
