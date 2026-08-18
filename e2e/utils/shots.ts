import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";

/**
 * Numbered journey screenshots.
 *
 * The suite's global `screenshot: "only-on-failure"` answers "what did it look
 * like when it broke". This answers a different question — "what did the
 * customer see at every step of a run that passed" — which is what makes a
 * green journey reviewable by a human instead of merely reassuring.
 *
 * Files land in e2e/.artifacts/screenshots/<project>/NN-name.png in the order they
 * were taken, and each is attached to the HTML report so `npx playwright
 * show-report` walks the whole purchase as a filmstrip.
 */

const ROOT = path.join("e2e", ".artifacts", "screenshots");

/**
 * One counter per project. The journey runs serially in a single worker, so a
 * module-level counter numbers the shots in true chronological order — which a
 * per-test counter could not do.
 */
const counters = new Map<string, number>();

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export type ShotOptions = {
  /**
   * Capture past the fold. Off by default: the storefront pins a scroll-driven
   * canvas section, and a full-page capture scrolls the document to stitch it —
   * which moves the very animation the next assertion is about.
   */
  fullPage?: boolean;
  /** Photograph one element rather than the viewport. */
  clipTo?: import("@playwright/test").Locator;
};

/**
 * Takes the next numbered screenshot and attaches it to the report.
 *
 * Returns the path, so a caller can log it. Never throws on a capture failure:
 * a screenshot is documentation, and losing one must not turn a genuine pass
 * into a red build.
 */
export async function shot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  opts: ShotOptions = {},
): Promise<string | null> {
  const key = testInfo.project.name || "default";
  const n = (counters.get(key) ?? 0) + 1;
  counters.set(key, n);

  const seq = String(n).padStart(2, "0");
  const dir = path.join(ROOT, key);
  const file = path.join(dir, `${seq}-${slugify(name)}.png`);

  try {
    mkdirSync(dir, { recursive: true });

    const target = opts.clipTo ?? page;
    await target.screenshot({
      path: file,
      // Motion drives most of this UI; a shot taken mid-transition is a
      // different picture on every run and tells a reviewer nothing.
      animations: "disabled",
      caret: "hide",
      ...(opts.clipTo ? {} : { fullPage: opts.fullPage ?? false, scale: "css" as const }),
    });

    await testInfo.attach(`${seq} — ${name}`, { path: file, contentType: "image/png" });
    return file;
  } catch (err) {
    console.warn(`[shots] could not capture "${name}":`, (err as Error).message);
    return null;
  }
}

/** Where this project's shots were written, for an end-of-run pointer. */
export function shotsDir(testInfo: TestInfo) {
  return path.resolve(ROOT, testInfo.project.name || "default");
}
