import { test, expect } from "../fixtures";
import { addToCart, cartButton, cartDrawer, nav, openCart, openMobileMenu } from "../utils/selectors";

/**
 * Mobile-specific navigation and buying affordances.
 *
 * These are the counterparts to the @desktop specs the mobile project skips.
 * Most Indian D2C traffic is phones, so the mobile path deserves its own
 * assertions rather than inheriting desktop ones and quietly passing because a
 * selector happened to match something else.
 */

// Tagged @mobile so the desktop project skips them (see playwright.config).
test.describe("mobile navigation", () => {
  test("@smoke @mobile the bar shows a menu button, the logo and the cart", async ({ page }) => {
    await page.goto("/");
    const bar = nav(page);

    await expect(bar.getByRole("button", { name: /open menu/i })).toBeVisible();
    await expect(bar.getByRole("link", { name: /avenues — home/i })).toBeVisible();
    await expect(bar.getByRole("button", { name: /^cart/i })).toBeVisible();
  });

  /**
   * Wishlist and account live ON the bar, not only in the drawer.
   *
   * They were `hidden sm:inline-flex`, so on a phone the only route to a saved
   * list was: open the drawer, scroll past the fragrance list, find it in the
   * footer. The badge count was invisible there too, which meant tapping the
   * heart on a product gave no confirmation anywhere the visitor could see.
   */
  test("@smoke @mobile wishlist and account are reachable from the bar itself", async ({
    page,
  }) => {
    await page.goto("/");
    const bar = nav(page);

    await expect(bar.getByRole("link", { name: /wishlist/i })).toBeVisible();
    await expect(bar.getByRole("link", { name: /sign in|your account/i })).toBeVisible();
  });

  /**
   * The bar is the tightest layout in the app, and the lockup has to carry the
   * mark AND the name on every phone that renders it.
   *
   * It used to carry the mark alone below 400px, so a 360px phone and a 400px
   * phone showed two different brands. That was a consequence of the lockup
   * being absolutely centred — a centred element is bounded by twice its
   * distance to the nearer edge, and the four-control cluster made that far
   * too small for the name. It is a flex item now, so the flex layout keeps it
   * off the icons; what still has to be asserted is that the sizes in
   * components/brand/logo.tsx leave it room to sit there without collapsing.
   */
  test("@mobile the lockup keeps the brand name and clears the icon cluster", async ({ page }) => {
    for (const width of [320, 360, 375, 390, 412]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");

      const logo = await nav(page)
        .getByRole("link", { name: /avenues — home/i })
        .boundingBox();
      const wishlist = await nav(page)
        .getByRole("link", { name: /wishlist/i })
        .boundingBox();
      const menu = await nav(page)
        .getByRole("button", { name: /open menu/i })
        .boundingBox();

      expect(logo && wishlist && menu, `missing nav elements at ${width}px`).toBeTruthy();

      // The name, not just the monogram. This is the regression that started
      // it: the wordmark was gated behind `min-[400px]`.
      const word = nav(page).getByRole("img", { name: "Avenues" });
      await expect(word, `no wordmark at ${width}px`).toBeVisible();
      const wordBox = await word.boundingBox();
      expect(wordBox!.width, `wordmark collapsed at ${width}px`).toBeGreaterThan(60);
      expect(
        logo!.x + logo!.width,
        `lockup overlaps the icon cluster at ${width}px`,
      ).toBeLessThanOrEqual(wishlist!.x + 1);
      expect(logo!.x, `lockup overlaps the menu button at ${width}px`).toBeGreaterThanOrEqual(
        menu!.x + menu!.width - 1,
      );
    }
  });

  test("@smoke @mobile the menu opens and reaches every fragrance", async ({ page }) => {
    await page.goto("/");
    const menu = await openMobileMenu(page);

    for (const label of [/^shop$/i, /gift sets/i, /know avenues/i, /track order/i, /contact/i]) {
      await expect(menu.getByRole("link", { name: label }).first()).toBeVisible();
    }
    await expect(menu.getByRole("link", { name: /night drip/i }).first()).toBeVisible();
  });

  test("@mobile the menu offers sign-in when signed out", async ({ page }) => {
    await page.goto("/");
    const menu = await openMobileMenu(page);
    await expect(menu.getByRole("link", { name: /login|sign in|account/i }).first()).toBeVisible();
  });

  /**
   * The badge IS the confirmation.
   *
   * Adding used to throw the drawer — a full-height sheet on a phone — over
   * whatever was being read, so the shopper had to dismiss it before carrying
   * on. Now the count on the bar goes up and the page stays put, which puts
   * the whole weight of the confirmation on this badge being right.
   */
  test("@mobile the cart badge counts what was added, and nothing covers the page", async ({
    page,
  }) => {
    await page.goto("/fragrance/night-drip");
    await addToCart(page);

    // aria-label carries the count so it is announced, not just drawn.
    await expect(cartButton(page, 1)).toBeVisible();
    await expect(cartDrawer(page)).toBeHidden();

    // Tapping the cart is still the way in.
    await expect(await openCart(page)).toBeVisible();
  });

  test("@mobile the PDP shows a thumb-reachable sticky buy bar", async ({ page }) => {
    await page.goto("/fragrance/intense");

    // Scroll past the buy box so the sticky bar takes over.
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2));
    await page.waitForTimeout(800);

    const buttons = page.getByRole("button", { name: "Add to cart" });
    const count = await buttons.count();
    expect(count, "a duplicate add-to-cart should exist in the sticky bar").toBeGreaterThan(1);

    // And the one at the bottom of the viewport must be reachable.
    const last = buttons.last();
    const box = await last.boundingBox();
    const vh = page.viewportSize()!.height;
    expect(box, "sticky bar button should be laid out").not.toBeNull();
    expect(box!.y, "sticky bar sits in the lower half of the screen").toBeGreaterThan(vh * 0.5);
  });
});
