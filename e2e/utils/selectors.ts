import { expect, type Page, type Locator } from "@playwright/test";

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
  // The facet chips carry their result count ("Him 2"), so match the prefix.
  const facet = page.getByRole("button", { name: /^(him|her|anyone)\b/i }).first();

  // Desktop keeps them on screen permanently.
  if (await facet.isVisible().catch(() => false)) return;

  // Below `lg` they collapse behind a control labelled "Filter", which gains a
  // "(n)" count once facets are active.
  //
  // Retry the open, don't just wait longer before one click. `isVisible()`
  // does not auto-wait, so a single check can run before the toggle is
  // painted and silently skip — and the toggle is client-side, so even a
  // landed click is lost if React has not attached its handler yet. Looping
  // until a facet is genuinely reachable covers both.
  const toggle = page.getByRole("button", { name: /^filter\b/i }).first();
  await expect(async () => {
    if (!(await facet.isVisible().catch(() => false))) {
      await toggle.click({ timeout: 5_000 });
    }
    await expect(facet).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 25_000 });
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

/**
 * Opens the email + password form on /login.
 *
 * The Phone OTP tab only exists when SMS is configured (`integrations.sms`).
 * With MSG91 unset — which is the E2E environment, and the launch
 * configuration until DLT registration clears — the page renders the password
 * form alone with no tab bar. This tolerates both, so the suite does not pin
 * the app to one of them.
 */
export async function openEmailLogin(page: Page) {
  await page.goto("/login");
  const tab = page.getByRole("tab", { name: "Email" });
  if (await tab.isVisible().catch(() => false)) await tab.click();
  return main(page);
}

/** True when the login page is offering phone OTP. */
export async function phoneOtpOffered(page: Page) {
  return page.getByRole("tab", { name: "Phone OTP" }).isVisible().catch(() => false);
}

/**
 * Click "Add to cart" and wait for the drawer, tolerating a pre-hydration click.
 *
 * The button is server-rendered, so it is present and clickable before React
 * attaches onClick. A click inside that window is swallowed silently — no
 * error, no drawer — and whatever assertion follows fails against a page that
 * works perfectly a moment later. The window widens with the route's JS, so
 * this gets flakier as the app grows rather than settling down.
 *
 * Every spec that adds to the cart should go through here. Three of them had
 * hand-rolled the bare click and each was one slow render away from the same
 * intermittent failure; the journey had already solved it privately.
 */
export async function addToCart(page: Page) {
  const add = main(page).getByRole("button", { name: "Add to cart" }).first();
  const drawer = cartDrawer(page);

  await expect(async () => {
    if (!(await drawer.isVisible().catch(() => false))) {
      await add.click({ timeout: 5_000 });
    }
    await expect(drawer).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 25_000 });

  return drawer;
}
