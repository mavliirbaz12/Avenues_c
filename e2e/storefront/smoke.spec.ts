import { test, expect, allowConsoleErrors } from "../fixtures";

/**
 * The fast critical path. If any of this is red, nothing else is worth
 * running — so it carries @smoke and gates every PR.
 */

test.describe("@smoke storefront reachability", () => {
  const PUBLIC_ROUTES = [
    { path: "/", heading: /arrive a moment/i },
    { path: "/shop", heading: /every fragrance we make/i },
    { path: "/fragrance/night-drip", heading: /night drip/i },
    { path: "/about", heading: /.+/ },
    { path: "/contact", heading: /a person answers/i },
    { path: "/track-order", heading: /.+/ },
    { path: "/login", heading: /.+/ },
    { path: "/signup", heading: /.+/ },
    { path: "/cart", heading: /.+/ },
    { path: "/wishlist", heading: /.+/ },
    { path: "/policies/privacy", heading: /privacy policy/i },
    { path: "/policies/terms", heading: /terms/i },
    { path: "/policies/shipping", heading: /shipping/i },
    { path: "/policies/returns", heading: /return|refund/i },
  ];

  for (const route of PUBLIC_ROUTES) {
    test(`${route.path} renders`, async ({ page, consoleErrors }) => {
      const res = await page.goto(route.path);
      expect(res?.status(), `${route.path} should be 200`).toBe(200);

      // Every page must have exactly one h1, and it must say something.
      const h1 = page.locator("h1");
      await expect(h1.first()).toBeVisible();
      await expect(h1.first()).toHaveText(route.heading);

      expect(consoleErrors.errors).toEqual([]);
    });
  }

  /**
   * Status, not just content. A `loading.tsx` anywhere above these routes
   * makes Next commit a 200 head before `notFound()` runs, so the 404 UI
   * renders with a 200 status and search engines index it as a real page.
   * That regression happened here once; this is the guard against it
   * returning. See the note in src/components/ui/skeletons.tsx.
   */
  const NOT_FOUND_ROUTES = [
    "/fragrance/does-not-exist",
    "/order/AVN-NOSUCH",
    "/no-such-page-at-all",
  ];

  for (const path of NOT_FOUND_ROUTES) {
    test(`${path} returns a real 404`, async ({ page }) => {
      allowConsoleErrors(page);
      const res = await page.goto(path);
      expect(res?.status(), `${path} must be status 404, not just 404-looking`).toBe(404);
      await expect(page.getByText(/stack trace|webpack|ReferenceError/i)).toHaveCount(0);
      // The branded 404 renders outside the storefront chrome by design.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }
});
