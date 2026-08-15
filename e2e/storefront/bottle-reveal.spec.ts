import { test, expect } from "../fixtures";

/**
 * The scroll-scrubbed bottle reveal.
 *
 * A screenshot of a canvas proves nothing on its own — a stuck sequence looks
 * identical to a working one in a single frame. So these specs capture the
 * canvas at several scroll depths and assert the pixels DIFFER, then scroll
 * back and assert it returns to where it started.
 */

const REVEAL = '[data-testid="bottle-reveal"]';
const CANVAS = '[data-testid="bottle-reveal-canvas"]';

/** Scroll to a fraction of the pinned section's runway and let the lerp settle. */
async function scrubTo(page: import("@playwright/test").Page, pct: number) {
  const box = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return null;
    return { top: el.getBoundingClientRect().top + window.scrollY, height: el.offsetHeight };
  }, REVEAL);
  if (!box) throw new Error("reveal section not found");

  const viewport = page.viewportSize()!.height;
  await page.evaluate((y) => window.scrollTo(0, y), box.top + (box.height - viewport) * pct);
  // The scrub eases toward its target on rAF rather than snapping, so give it
  // time to arrive. This is settling, not a blind sleep — the assertion below
  // is what actually decides the test.
  await page.waitForTimeout(1200);
}

test.describe("bottle reveal", () => {
  test("@smoke section pins and the canvas mounts", async ({ page }) => {
    await page.goto("/");
    const section = page.locator(REVEAL);
    await expect(section).toHaveCount(1);

    // Tall runway: the sticky child needs somewhere to be pinned.
    const height = await section.evaluate((el) => (el as HTMLElement).offsetHeight);
    const viewport = page.viewportSize()!.height;
    expect(height, "reveal needs a scroll runway taller than the viewport").toBeGreaterThan(
      viewport * 2,
    );

    await expect(page.locator(CANVAS)).toHaveCount(1);
  });

  test("@smoke scrolling advances the sequence, and scrolling back reverses it", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    // Let the coarse-first batch land so the canvas has frames to draw.
    await page.waitForTimeout(3500);

    const canvas = page.locator(CANVAS);
    const shots: string[] = [];

    for (const pct of [0, 0.35, 0.7, 1]) {
      await scrubTo(page, pct);
      shots.push((await canvas.screenshot()).toString("base64"));
    }

    const distinct = new Set(shots);
    expect(
      distinct.size,
      "each scroll depth should draw a different frame — a stuck canvas yields identical captures",
    ).toBeGreaterThanOrEqual(3);

    // Reverse: back to the start should redraw the opening frame.
    await scrubTo(page, 0);
    const back = (await canvas.screenshot()).toString("base64");
    expect(back, "scrolling back up must reverse the sequence").toBe(shots[0]);
  });

  test("text beats change across the sequence", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(3000);

    // All three beats stay mounted and cross-fade, so innerText is identical
    // at every scroll depth. Opacity is what actually changes.
    const opacities = async () =>
      page.locator(`${REVEAL} h2`).evaluateAll((els) =>
        els.map((e) => Number(getComputedStyle(e.parentElement as Element).opacity)),
      );

    await scrubTo(page, 0.05);
    const atStart = await opacities();

    await scrubTo(page, 0.95);
    const atEnd = await opacities();

    expect(atStart.length, "there should be several beats").toBeGreaterThan(1);
    expect(Math.max(...atStart), "a beat must be visible near the start").toBeGreaterThan(0.5);
    expect(Math.max(...atEnd), "a beat must be visible at the end").toBeGreaterThan(0.5);
    expect(
      atStart.indexOf(Math.max(...atStart)),
      "a different beat should be showing at the end",
    ).not.toBe(atEnd.indexOf(Math.max(...atEnd)));
    // The final beat carries the CTA into the collection.
    await expect(
      page.locator(REVEAL).getByRole("link", { name: /explore the collection/i }),
    ).toBeVisible();
  });

  test("the sequence loads coarse-first so the scrub works before every frame lands", async ({
    page,
  }) => {
    const requested: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/sequence/")) requested.push(r.url());
    });

    await page.goto("/");
    await page.waitForTimeout(2500);

    const early = requested.length;
    expect(early, "some frames must load quickly").toBeGreaterThan(5);

    // The priority pass is a stride, not the first N in order — so the early
    // requests should span the whole sequence, not cluster at the start.
    const indices = requested
      .slice(0, 15)
      .map((u) => Number(/-(\d{4})\.webp$/.exec(u)?.[1] ?? -1))
      .filter((n) => n >= 0);
    expect(Math.max(...indices), "priority pass should reach the end of the sequence").toBeGreaterThan(
      60,
    );
  });

  test("serves the small frame set on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const requested: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/sequence/")) requested.push(r.url());
    });

    await page.goto("/");
    await page.waitForTimeout(2500);

    expect(requested.length).toBeGreaterThan(0);
    expect(
      requested.every((u) => /\/sequence\/sm-/.test(u)),
      "a phone must not download the 1200px frames",
    ).toBe(true);
  });

  test("reduced motion loads no sequence and collapses to one viewport", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();

    const requested: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/sequence/")) requested.push(r.url());
    });

    await page.goto("/");
    await page.waitForTimeout(2500);

    const section = page.locator(REVEAL);
    await expect(section).toHaveAttribute("data-reduced", "true");
    // No canvas, no rAF loop.
    await expect(page.locator(CANVAS)).toHaveCount(0);

    // Exactly one image: the static final frame. The scrub must not load.
    expect(
      requested.length,
      `reduced motion should fetch at most the single fallback frame, got ${requested.length}`,
    ).toBeLessThanOrEqual(1);

    const height = await section.evaluate((el) => (el as HTMLElement).offsetHeight);
    expect(height, "no pinning under reduced motion").toBeLessThan(
      page.viewportSize()!.height * 2,
    );

    await ctx.close();
  });
});
