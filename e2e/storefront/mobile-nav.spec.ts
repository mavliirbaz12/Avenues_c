import { test, expect } from "../fixtures";
import { addToCart, cartDrawer, main, nav } from "../utils/selectors";

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
   * The bar is the tightest layout in the app and it just gained two controls.
   * The centred lockup is absolutely positioned, so nothing in the flex layout
   * stops it running underneath the icons — only the measured sizes in
   * components/brand/logo.tsx do. This asserts that measurement holds.
   */
  test("@mobile the lockup does not collide with the icon cluster", async ({ page }) => {
    for (const width of [320, 360, 412]) {
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
    await nav(page).getByRole("button", { name: /open menu/i }).click();

    const menu = page.getByRole("dialog").or(page.locator("[data-mobile-menu]")).first();
    const scope = (await menu.count()) ? menu : page;

    for (const label of [/^shop$/i, /gift sets/i, /know avenues/i, /track order/i, /contact/i]) {
      await expect(scope.getByRole("link", { name: label }).first()).toBeVisible();
    }
    await expect(scope.getByRole("link", { name: /night drip/i }).first()).toBeVisible();
  });

  test("@mobile the menu offers sign-in when signed out", async ({ page }) => {
    await page.goto("/");
    await nav(page).getByRole("button", { name: /open menu/i }).click();
    await expect(
      page.getByRole("link", { name: /login|sign in|account/i }).first(),
    ).toBeVisible();
  });

  test("@mobile the cart badge counts what was added", async ({ page }) => {
    await page.goto("/fragrance/night-drip");
    await addToCart(page);
    await expect(cartDrawer(page)).toBeVisible();
    await page.keyboard.press("Escape");

    // aria-label carries the count so it is announced, not just drawn.
    await expect(nav(page).getByRole("button", { name: /cart, 1 item/i })).toBeVisible();
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
