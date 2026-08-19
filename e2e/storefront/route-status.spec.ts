import { test, expect } from "../fixtures";

/**
 * HTTP status, asserted directly — because the rendered page cannot tell you.
 *
 * A 404 body served with a 200 status looks completely correct in a browser
 * and completely wrong to a crawler, which indexes it as a real page. That is
 * not hypothetical here: a `loading.tsx` at the `(store)` group root has been
 * added twice (9804d0c, 4d7149d) and removed once (acb47cf) for exactly this
 * reason. A Suspense boundary commits the response head as soon as it starts
 * streaming the fallback, so every notFound() beneath it arrives too late to
 * set the status.
 *
 * The second time it shipped to production, and /fragrance/<unknown>,
 * /set/<unknown> and /order/<unknown> all answered 200.
 *
 * These specs are the tripwire. They assert the status code and nothing about
 * the markup, so they stay true however the 404 page is redesigned. See the
 * boundary rules in src/components/ui/skeletons.tsx before adding any
 * loading.tsx.
 */

test.describe("@smoke unknown routes return 404, not 200", () => {
  const UNKNOWN = [
    { path: "/fragrance/no-such-fragrance-xyz", why: "unknown fragrance slug" },
    { path: "/set/no-such-set-xyz", why: "unknown set slug" },
    { path: "/order/NOSUCHORDER123", why: "unknown order number" },
    { path: "/no-such-page-xyz", why: "unknown top-level route" },
  ];

  for (const route of UNKNOWN) {
    test(`${route.path} → 404 (${route.why})`, async ({ page }) => {
      const res = await page.goto(route.path);
      expect(
        res?.status(),
        `${route.path} must 404. A 200 here means a loading.tsx boundary was ` +
          `added above this route — see src/components/ui/skeletons.tsx.`,
      ).toBe(404);
    });
  }
});

test.describe("gift sets are never reachable at /fragrance/…", () => {
  /**
   * Product.slug is shared across both product types, so a combo has a valid
   * slug at both paths unless something stops it. `/fragrance/<combo>` used to
   * render an empty 200: the nav linked sets there (getNavFragrances returned
   * combos with no type, and three consumers hardcoded the fragrance path),
   * and the loading boundary swallowed the 404. Clicking "Discovery Set" in
   * the Fragrances menu produced a blank page.
   */
  test("@smoke a combo slug redirects to its canonical /set/ URL", async ({ page }) => {
    const res = await page.goto("/fragrance/discovery-set");

    expect(page.url(), "should land on the canonical set URL").toContain("/set/discovery-set");
    expect(res?.status(), "and it should be a real page, not an empty 200").toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
