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
 * Opens the mobile menu.
 *
 * The click is retried until the drawer is actually on screen, for the same
 * reason addToCart retries: the nav is a client component rendered on the
 * server, so the button exists and accepts clicks a beat before React attaches
 * `onClick`. A click inside that window is swallowed with no error, and the
 * assertion that follows fails against a menu that opens perfectly a moment
 * later. Two specs hand-rolled the bare click and both were intermittent.
 */
export async function openMobileMenu(page: Page) {
  const menu = page.getByRole("dialog", { name: "Menu" });

  await expect(async () => {
    if (!(await menu.isVisible().catch(() => false))) {
      await nav(page).getByRole("button", { name: /open menu/i }).click({ timeout: 5_000 });
    }
    await expect(menu).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 25_000 });

  return menu;
}

/**
 * Opens the search overlay from wherever it lives on this viewport: a labelled
 * control in the desktop nav, or inside the mobile menu.
 *
 * Retried end-to-end rather than click-and-hope — see openMobileMenu. The
 * condition is the search box itself, so whichever route was taken has to
 * finish with a field the caller can type into.
 */
export async function openSearch(page: Page) {
  const direct = nav(page).getByRole("button", { name: /search fragrances/i });
  const box = page.getByRole("searchbox").or(page.getByPlaceholder(/search/i)).first();

  await expect(async () => {
    if (await box.isVisible().catch(() => false)) return;

    if (await direct.isVisible().catch(() => false)) {
      await direct.click({ timeout: 5_000 });
    } else {
      const menu = await openMobileMenu(page);
      await menu.getByRole("button", { name: /search/i }).first().click({ timeout: 5_000 });
    }
    await expect(box).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 25_000 });

  return box;
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
 * Click "Add to cart" and wait for the bar to acknowledge it.
 *
 * Adding does NOT open the drawer — see components/product/add-to-cart-button.tsx
 * for why. The confirmation a shopper actually gets is the count on the cart
 * button, so that is what this waits on, and waiting on it asserts the real
 * contract rather than a side effect of it.
 *
 * The button is server-rendered, so it is present and clickable before React
 * attaches onClick. A click inside that window is swallowed silently — no
 * error, no count — and whatever assertion follows fails against a page that
 * works perfectly a moment later. The window widens with the route's JS, so
 * this gets flakier as the app grows rather than settling down.
 *
 * Every spec that adds to the cart goes through here, the journey included —
 * it used to keep a private copy of this retry, which meant a change to how
 * adding confirms itself had two places to land instead of one.
 *
 * `expected` is the item count the bar should report once the click lands —
 * 1 for the usual "add one thing to an empty cart".
 */
export async function addToCart(page: Page, expected = 1) {
  const add = main(page).getByRole("button", { name: "Add to cart" }).first();
  // The count lives in the aria-label, so this asserts what a screen reader is
  // told, not just what is drawn.
  const settled = cartButton(page, expected);

  await expect(async () => {
    if (!(await settled.isVisible().catch(() => false))) {
      await add.click({ timeout: 5_000 });
    }
    await expect(settled).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 25_000 });
}

/**
 * Click "Buy now" and wait for it to land.
 *
 * Same pre-hydration race as addToCart and the same retry: the button is
 * server-rendered, so it accepts clicks before React attaches its handler and
 * a swallowed click leaves the page exactly where it was, with nothing in the
 * cart and no error to explain it. Under a loaded suite this failed reliably
 * enough to look like a broken feature, and passed three times out of three in
 * isolation.
 *
 * Where it lands depends on the session — /checkout when signed in, /login
 * with the destination preserved when not — so the caller says which.
 */
export async function buyNow(page: Page, lands: RegExp = /\/checkout/) {
  const buy = main(page).getByRole("button", { name: /buy now/i }).first();

  await expect(async () => {
    if (lands.test(page.url())) return;
    await buy.click({ timeout: 5_000 });
    await page.waitForURL(lands, { timeout: 5_000 });
  }).toPass({ timeout: 25_000 });
}

/**
 * The nav's cart control, optionally pinned to the count it should be
 * reporting. `items` omitted matches it whatever the cart holds.
 */
export function cartButton(page: Page, items?: number): Locator {
  const name =
    items === undefined
      ? /^cart\b/i
      : items === 0
        ? /^cart, empty/i
        : new RegExp(String.raw`^cart, ${items} items?\b`, "i");
  return nav(page).getByRole("button", { name });
}

/**
 * Open the cart drawer from the bar.
 *
 * Specs that want to look inside the cart now have to say so, because adding
 * no longer does it for them. Same retry shape as addToCart, and for the same
 * reason: the nav is a client component and its handler lands late.
 */
export async function openCart(page: Page) {
  const drawer = cartDrawer(page);

  await expect(async () => {
    if (!(await drawer.isVisible().catch(() => false))) {
      await cartButton(page).click({ timeout: 5_000 });
    }
    await expect(drawer).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 25_000 });

  return drawer;
}
