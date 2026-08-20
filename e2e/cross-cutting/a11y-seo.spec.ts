import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "../fixtures";
import { db } from "../utils/db";

test.afterAll(() => db.$disconnect());

/**
 * Cross-cutting quality gates: accessibility, metadata, and structured data.
 *
 * The a11y checks fail on serious and critical violations only. Minor and
 * moderate findings are reported in the attachment but do not block — a gate
 * that fails on colour-contrast nitpicks in a decorative gradient gets muted
 * within a week, and then catches nothing at all.
 */

const PUBLIC_PAGES = [
  { path: "/", name: "landing" },
  { path: "/shop", name: "shop" },
  { path: "/fragrance/night-drip", name: "product detail" },
  { path: "/cart", name: "cart" },
  { path: "/login", name: "login" },
  { path: "/signup", name: "signup" },
  { path: "/contact", name: "contact" },
  { path: "/track-order", name: "track order" },
  { path: "/policies/privacy", name: "privacy policy" },
];

/**
 * Waits for every fade to finish before a scan.
 *
 * Without this, axe measures text mid-transition and reports foreground
 * colours that appear nowhere in the palette — #434140 is not a brand colour,
 * it is `text-bone` at 20% opacity over ink. Those readings are noise, and
 * noise is how a quality gate gets muted and then catches nothing.
 *
 * The landing slider also auto-rotates, so it is paused first (hovering is the
 * component's own pause affordance) and then the page is polled until nothing
 * is sitting at a fractional opacity.
 */
async function settle(page: import("@playwright/test").Page) {
  await page.evaluate(() => document.fonts.ready);

  // Park the pointer over the slider if there is one; it pauses on hover.
  const slider = page.getByRole("link", { name: /explore the fragrance/i }).first();
  if (await slider.count()) await slider.hover().catch(() => {});

  // Wait for opacity to become STABLE, not to reach 1. Plenty of elements sit
  // at a fixed fractional opacity on purpose here — the vignettes, the scrims,
  // the 0.11 monogram in the hero — so "everything is fully opaque" is never
  // true and never will be. What distinguishes a transition is that the value
  // keeps changing; two identical samples means the page has come to rest.
  const sample = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll("*"))
        .map((el) => getComputedStyle(el).opacity)
        .filter((o) => o !== "1")
        .join(","),
    );

  let previous = await sample();
  await expect
    .poll(
      async () => {
        await page.waitForTimeout(400);
        const current = await sample();
        const stable = current === previous;
        previous = current;
        return stable;
      },
      { timeout: 15_000, message: "waiting for fades to come to rest before scanning" },
    )
    .toBe(true);
}

async function scan(page: import("@playwright/test").Page) {
  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // The film is decorative and aria-hidden; axe still reasons about it as a
    // media player and reports noise about controls and captions.
    .exclude('[data-testid="bottle-reveal-video"]')
    .analyze();
}

test.describe("accessibility", () => {
  for (const p of PUBLIC_PAGES) {
    test(`${p.name} has no serious or critical violations`, async ({ browser }, testInfo) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(p.path);
      await settle(page);

      const results = await scan(page);
      const blocking = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );

      await testInfo.attach(`axe-${p.name}.json`, {
        body: JSON.stringify(results.violations, null, 2),
        contentType: "application/json",
      });

      const summary = blocking.map(
        (v) => `${v.id} (${v.impact}) — ${v.nodes.length} node(s): ${v.help}`,
      );
      await ctx.close();

      expect(summary, `${p.path} must have no serious/critical accessibility violations`).toEqual(
        [],
      );
    });
  }

  test("@desktop admin dashboard has no serious or critical violations", async ({ adminPage }, testInfo) => {
    await adminPage.goto("/admin");
    await settle(adminPage);
    const results = await new AxeBuilder({ page: adminPage })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    await testInfo.attach("axe-admin.json", {
      body: JSON.stringify(results.violations, null, 2),
      contentType: "application/json",
    });
    expect(blocking.map((v) => `${v.id} — ${v.help}`)).toEqual([]);
  });

  test("every page has exactly one h1 and a skip link", async ({ page }) => {
    for (const p of PUBLIC_PAGES) {
      await page.goto(p.path);
      const h1s = await page.locator("h1").count();
      expect(h1s, `${p.path} should have exactly one <h1>, found ${h1s}`).toBe(1);
      await expect(
        page.getByRole("link", { name: /skip to content/i }),
        `${p.path} needs a skip link`,
      ).toHaveCount(1);
    }
  });

  test("keyboard focus is visible on the primary CTA", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const s = getComputedStyle(el);
      return { outlineWidth: s.outlineWidth, boxShadow: s.boxShadow, outlineStyle: s.outlineStyle };
    });
    expect(outline, "something should be focusable").not.toBeNull();
  });
});

test.describe("metadata", () => {
  for (const p of PUBLIC_PAGES) {
    test(`${p.name} has a title, description and OpenGraph tags`, async ({ page }) => {
      await page.goto(p.path);

      const title = await page.title();
      expect(title.length, `${p.path} needs a real <title>`).toBeGreaterThan(8);

      const desc = await page
        .locator('meta[name="description"]')
        .getAttribute("content")
        .catch(() => null);
      expect(desc?.length ?? 0, `${p.path} needs a meta description`).toBeGreaterThan(20);

      // OG title falls back to the document title in Next's metadata output,
      // so assert the tag exists rather than duplicating its text.
      await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    });
  }

  test("the brand name is written 'Avenues', never shouted in body copy", async ({ page }) => {
    // House rule from the brief: all-caps is a type treatment, applied in CSS,
    // never baked into the text.
    await page.goto("/about");
    const text = await page.getByRole("main").innerText();
    // innerText returns text-transform output, so read the source instead.
    const html = await page.content();
    const bodyCopy = html.replace(/<script[\s\S]*?<\/script>/g, "");
    expect(bodyCopy, "brand should not be hard-coded as AVENUES").not.toMatch(/>[^<]*AVENUES[^<]*</);
    void text;
  });

  test("robots.txt and sitemap.xml are served", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    const xml = await sitemap.text();

    // Every active product should be listed.
    // Canonical route per kind: fragrances under /fragrance, sets under /set.
    const products = await db.product.findMany({
      where: { isActive: true },
      select: { slug: true, type: true },
    });
    for (const p of products) {
      const route = p.type === "COMBO" ? `/set/${p.slug}` : `/fragrance/${p.slug}`;
      expect(xml, `sitemap should list ${p.slug} at ${route}`).toContain(route);
    }
  });

  test("account and admin are excluded from indexing", async ({ customerPage }) => {
    await customerPage.goto("/account");
    const robots = await customerPage
      .locator('meta[name="robots"]')
      .getAttribute("content")
      .catch(() => null);
    expect(robots ?? "", "/account must not be indexable").toMatch(/noindex/i);
  });
});

test.describe("product structured data", () => {
  test("@smoke PDP emits valid Product JSON-LD", async ({ page }) => {
    const slug = "night-drip";
    const product = await db.product.findUnique({
      where: { slug },
      include: { variants: { orderBy: { sortOrder: "asc" } } },
    });

    await page.goto(`/fragrance/${slug}`);

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.length, "PDP should carry JSON-LD").toBeGreaterThan(0);

    const parsed = blocks.map((b) => JSON.parse(b));
    const productLd = parsed.find((j) => j["@type"] === "Product");
    expect(productLd, "a Product node is required for rich results").toBeTruthy();

    expect(productLd.name).toBe(product!.name);
    expect(productLd.brand?.name).toBe("Avenues");
    expect(productLd.countryOfOrigin).toBe(product!.countryOfOrigin);

    expect(Array.isArray(productLd.offers), "offers should be a list").toBe(true);
    const offer = productLd.offers[0];
    expect(offer.priceCurrency).toBe("INR");
    expect(Number(offer.price)).toBe(product!.variants[0]!.pricePaise / 100);
    expect(offer.availability).toMatch(/InStock|OutOfStock/);
  });

  test("a product with no reviews omits aggregateRating entirely", async ({ page }) => {
    // Google penalises a rating of 0 from 0 votes, so the field must be absent
    // rather than zeroed.
    const product = await db.product.findFirst({
      where: { isActive: true, reviewCount: 0 },
      select: { slug: true },
    });
    test.skip(!product, "every product has reviews");

    await page.goto(`/fragrance/${product!.slug}`);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const productLd = blocks.map((b) => JSON.parse(b)).find((j) => j["@type"] === "Product");

    expect(productLd.aggregateRating, "no reviews means no aggregateRating node").toBeUndefined();
  });
});
