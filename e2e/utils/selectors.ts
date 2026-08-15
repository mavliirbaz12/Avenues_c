import type { Page, Locator } from "@playwright/test";

/**
 * Scoping helpers.
 *
 * The storefront footer carries a compact enquiry form and a newsletter form
 * on EVERY page, so bare `getByLabel("Email")` is ambiguous almost everywhere
 * — it matches the page's own form and the footer's. Scoping to <main> is the
 * fix, and it is the honest one: it asserts the field is in the page content
 * rather than anywhere on the document.
 */

/** The page's own content, excluding the fixed header, footer and overlays. */
export function main(page: Page): Locator {
  return page.getByRole("main");
}

/** The slide-in cart. */
export function cartDrawer(page: Page): Locator {
  return page.getByRole("dialog", { name: "Your cart" });
}

/** Primary site navigation (the fixed header). */
export function nav(page: Page): Locator {
  return page.getByRole("navigation", { name: "Primary" });
}

/** The site footer. */
export function footer(page: Page): Locator {
  return page.getByRole("contentinfo");
}

/**
 * Opens the cart drawer's coupon field, which is collapsed behind a toggle
 * until a code is applied.
 */
export async function openCouponField(scope: Locator) {
  const toggle = scope.getByRole("button", { name: /have a coupon code/i });
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
  }
}
