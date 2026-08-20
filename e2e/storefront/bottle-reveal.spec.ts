import { test, expect } from "../fixtures";

/**
 * The bottle film.
 *
 * This section used to be a scroll-scrubbed frame sequence and these specs
 * used to prove the scrub worked by screenshotting a canvas at four scroll
 * depths and asserting the pixels differed. There is no canvas and no scrub
 * any more: the film plays itself, and the three text beats ride its clock.
 *
 * So the things worth asserting changed with it. A video element that exists
 * proves nothing — `autoplay` is refused by browsers routinely and the failure
 * is silent, leaving a poster that looks like a design choice. The test that
 * matters is that `currentTime` actually advances.
 */

const REVEAL = '[data-testid="bottle-reveal"]';
const VIDEO = '[data-testid="bottle-reveal-video"]';

/** Bring the section into view, which is what starts it. */
async function scrollToReveal(page: import("@playwright/test").Page) {
  await page.locator(REVEAL).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
}

async function currentTime(page: import("@playwright/test").Page) {
  return page.locator(VIDEO).evaluate((el) => (el as HTMLVideoElement).currentTime);
}

test.describe("bottle film", () => {
  test("@smoke the film mounts and runs edge to edge", async ({ page }) => {
    await page.goto("/");
    const section = page.locator(REVEAL);
    await expect(section).toHaveCount(1);
    await expect(page.locator(VIDEO)).toHaveCount(1);

    // Full bleed: the film spans the viewport, not the `shell` container.
    const width = await page.locator(VIDEO).evaluate((el) => el.getBoundingClientRect().width);
    const viewport = page.viewportSize()!.width;
    expect(width, "the film should run the full width of the viewport").toBeGreaterThanOrEqual(
      viewport - 1,
    );

    // And it no longer eats three screens of scroll to play six seconds.
    const height = await section.evaluate((el) => (el as HTMLElement).offsetHeight);
    expect(
      height,
      "the film should occupy about one screen, not a 400vh scrub runway",
    ).toBeLessThan(page.viewportSize()!.height * 1.5);
  });

  test("@smoke it plays on its own once it is on screen", async ({ page }) => {
    await page.goto("/");
    await scrollToReveal(page);

    // Poll rather than sleep-and-check: the first frames have to arrive over
    // the network before currentTime can move at all.
    await expect
      .poll(() => currentTime(page), {
        timeout: 20_000,
        message: "the film should start itself when scrolled into view",
      })
      .toBeGreaterThan(0.2);

    const first = await currentTime(page);
    await page.waitForTimeout(1200);
    const second = await currentTime(page);

    // Looping means `second` can wrap past the end, so assert movement rather
    // than a strictly larger number.
    expect(second, "the film should still be advancing a second later").not.toBe(first);
  });

  test("it stops when it is nowhere near the screen", async ({ page }) => {
    await page.goto("/");
    await scrollToReveal(page);
    await expect.poll(() => currentTime(page), { timeout: 20_000 }).toBeGreaterThan(0.2);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    const paused = await page.locator(VIDEO).evaluate((el) => (el as HTMLVideoElement).paused);
    expect(paused, "a looping film must not run under the rest of the page").toBe(true);
  });

  test("the beats play through once, then settle while the film keeps running", async ({
    page,
  }) => {
    await page.goto("/");
    await scrollToReveal(page);

    const video = page.locator(VIDEO);
    await expect
      .poll(() => video.evaluate((el) => (el as HTMLVideoElement).duration || 0), {
        timeout: 20_000,
      })
      .toBeGreaterThan(0);

    // All three beats stay mounted and cross-fade, so text content is identical
    // at every moment. Opacity is what changes.
    const opacities = async () =>
      page.locator(`${REVEAL} h2`).evaluateAll((els) =>
        els.map((e) => Number(getComputedStyle(e.parentElement as Element).opacity)),
      );

    /*
      Drive the clock rather than waiting the film out.

      Real time makes this a race against a six-second loop: sample too late
      and the first pass is already over, the copy has settled, and both
      samples read the same beat — for a reason that is correct behaviour.
      Pausing and seeking exercises the same handler deterministically.
    */
    await video.evaluate((el) => {
      const v = el as HTMLVideoElement;
      v.pause();
      v.currentTime = v.duration * 0.05;
    });
    await page.waitForTimeout(900);
    const early = await opacities();
    expect(early.length, "there should be several beats").toBeGreaterThan(1);
    expect(Math.max(...early), "a beat must be visible near the start").toBeGreaterThan(0.5);
    const earlyIndex = early.indexOf(Math.max(...early));

    await video.evaluate((el) => {
      const v = el as HTMLVideoElement;
      v.currentTime = v.duration * 0.85;
    });
    await page.waitForTimeout(900);
    const late = await opacities();
    expect(Math.max(...late), "a beat must be visible near the end").toBeGreaterThan(0.5);
    expect(
      late.indexOf(Math.max(...late)),
      "a different beat should be showing near the end",
    ).not.toBe(earlyIndex);

    // The final beat carries the CTA into the collection.
    await expect(
      page.locator(REVEAL).getByRole("link", { name: /explore the collection/i }),
    ).toBeVisible();
  });

  /**
   * The film is continuous; the copy is not.
   *
   * Looping the beats along with the picture meant the headline reset to "It
   * starts as detail." every six seconds and the CTA under the final beat went
   * with it. This is the assertion that keeps the two clocks apart: once the
   * film has wrapped, it is still playing and the button is still there.
   */
  test("@smoke it loops forever, and the CTA does not blink out with it", async ({ page }) => {
    await page.goto("/");
    await scrollToReveal(page);

    const cta = page.locator(REVEAL).getByRole("link", { name: /explore the collection/i });

    // The component marks the end of the first pass when the film wraps.
    await expect(page.locator(REVEAL)).toHaveAttribute("data-narrated", "true", {
      timeout: 30_000,
    });

    const state = await page.locator(VIDEO).evaluate((el) => ({
      paused: (el as HTMLVideoElement).paused,
      loop: (el as HTMLVideoElement).loop,
    }));
    expect(state.loop, "the film should be set to loop").toBe(true);
    expect(state.paused, "the film should still be running after its first pass").toBe(false);
    await expect(cta, "the CTA must survive the loop").toBeVisible();

    // And still be there a further pass later.
    await page.waitForTimeout(3000);
    await expect(cta).toBeVisible();
    expect(
      await page.locator(VIDEO).evaluate((el) => (el as HTMLVideoElement).paused),
      "still looping",
    ).toBe(false);
  });

  test("there are no playback controls over the film", async ({ page }) => {
    await page.goto("/");
    await scrollToReveal(page);

    await expect(page.getByRole("button", { name: /play|pause/i })).toHaveCount(0);
    expect(
      await page.locator(VIDEO).evaluate((el) => (el as HTMLVideoElement).controls),
      "the video element must not expose native controls either",
    ).toBe(false);
  });

  test("reduced motion shows the poster and never autoplays", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();

    await page.goto("/");
    const section = page.locator(REVEAL);
    await expect(section).toHaveAttribute("data-manual", "true");

    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);

    const state = await page.locator(VIDEO).evaluate((el) => {
      const v = el as HTMLVideoElement;
      return { paused: v.paused, time: v.currentTime };
    });
    expect(state.paused, "reduced motion must not autoplay").toBe(true);
    expect(state.time, "and must not have advanced").toBe(0);

    // And no control offering to start it anyway — the visitor has already
    // said they do not want this moving.
    await expect(page.getByRole("button", { name: /play|pause/i })).toHaveCount(0);

    // The heading and CTA still have to be readable with nothing playing —
    // without a clock the beats would otherwise all sit at opacity 0.
    await expect(
      page.locator(REVEAL).getByRole("link", { name: /explore the collection/i }),
    ).toBeVisible();
    const visible = await page.locator(`${REVEAL} h2`).evaluateAll((els) =>
      els.map((e) => Number(getComputedStyle(e.parentElement as Element).opacity)),
    );
    expect(Math.max(...visible), "a beat must be legible with the film paused").toBeGreaterThan(
      0.5,
    );

    await ctx.close();
  });

  test("the 1.3MB film is not fetched before the section is anywhere near view", async ({
    page,
  }) => {
    const filmRequests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("hero-reveal.mp4")) filmRequests.push(r.url());
    });

    await page.goto("/");
    await page.waitForTimeout(2500);

    expect(
      filmRequests.length,
      "preload=none plus the intersection gate should keep the film off the initial load",
    ).toBe(0);
  });
});
