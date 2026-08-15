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

/**
 * Opens the shop filter panel.
 *
 * On desktop the facets are always on screen; below `lg` they collapse behind
 * a "Filters" toggle. Specs call this so one assertion covers both layouts
 * instead of being duplicated per viewport.
 */
export async function openFilters(page: Page) {
  // The control is labelled "Filter" and gains a "(n)" count once facets are
  // active, so match on the prefix rather than the whole string.
  const toggle = page.getByRole("button", { name: /^filter\b/i }).first();
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
    // The panel animates open; wait for a facet to be clickable. The chips
    // carry their result count ("Him 2"), so match the prefix, not the whole
    // label.
    await page.getByRole("button", { name: /^(him|her|anyone)\b/i }).first().waitFor();
  }
}

/**
 * Opens the search overlay from wherever it lives on this viewport: a labelled
 * control in the desktop nav, or inside the mobile menu.
 */
export async function openSearch(page: Page) {
  const direct = nav(page).getByRole("button", { name: /search fragrances/i });
  if (await direct.isVisible().catch(() => false)) {
    await direct.click();
  } else {
    await nav(page).getByRole("button", { name: /open menu/i }).click();
    await page.getByRole("button", { name: /search/i }).first().click();
  }
  return page.getByRole("searchbox").or(page.getByPlaceholder(/search/i)).first();
}
