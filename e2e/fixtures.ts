import { test as base, expect as baseExpect, type Page } from "@playwright/test";
import { STORAGE } from "./utils/env";

/**
 * Shared fixtures.
 *
 * `customerPage` / `adminPage` / `guestPage` give a spec the role it needs
 * without repeating storageState wiring. `consoleErrors` is attached to every
 * page automatically — a page that throws in the console is a failure even if
 * every assertion passes, and finding that out per-spec is much cheaper than
 * a separate "no errors anywhere" sweep.
 */

/**
 * Console noise that is not ours and not actionable. Keep this list short and
 * justified; every entry is a hole in the net.
 */
const IGNORED_CONSOLE = [
  // Next dev-only hydration hints; harmless in prod builds but occasionally
  // emitted by the React refresh runtime during navigation.
  /Download the React DevTools/i,
  // Chromium emits this for the intentionally-blank favicon on some routes.
  /Failed to load resource.*favicon/i,
  // Autoplay rejection when a hero video is configured but the runner has no
  // user gesture — the component already handles it via onError/catch.
  /play\(\) (request was interrupted|failed)/i,
];

export type ConsoleWatcher = {
  /** Errors seen so far on this page. */
  errors: string[];
  /** Stop failing the test on console errors (for specs that provoke them). */
  ignore: () => void;
};

/**
 * Lets any helper reach a page's watcher, so `allowConsoleErrors(page)` works
 * for the role fixtures too and not just the bare `page`.
 */
const watchers = new WeakMap<Page, ConsoleWatcher>();

/**
 * Opt this page out of the console-error assertion.
 *
 * For specs that navigate somewhere deliberately broken — a 404, a rejected
 * API call — where Chromium logs "Failed to load resource" and that IS the
 * expected outcome. Call it in the test that provokes the error, never
 * globally: the whole value of the check is that it is on by default.
 */
export function allowConsoleErrors(page: Page) {
  watchers.get(page)?.ignore();
}

/**
 * Attaches the console-error net to a page the fixtures did not create.
 *
 * The journey spec builds its own context so one session can carry state
 * across steps; without this it would be the only spec in the suite where a
 * page throwing in the console goes unnoticed.
 */
export function watchConsole(page: Page): ConsoleWatcher {
  const errors: string[] = [];
  let active = true;

  page.on("console", (msg) => {
    if (!active || msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
    errors.push(text);
  });

  page.on("pageerror", (err) => {
    if (!active) return;
    errors.push(`[pageerror] ${err.message}`);
  });

  const watcher: ConsoleWatcher = {
    errors,
    ignore: () => {
      active = false;
      errors.length = 0;
    },
  };
  watchers.set(page, watcher);
  return watcher;
}

type Fixtures = {
  guestPage: Page;
  customerPage: Page;
  adminPage: Page;
  consoleErrors: ConsoleWatcher;
};

export const test = base.extend<Fixtures>({
  consoleErrors: async ({ page }, use) => {
    const watcher = watchConsole(page);
    await use(watcher);
    baseExpect(
      watcher.errors,
      `Console errors on ${page.url()}:\n${watcher.errors.join("\n")}`,
    ).toEqual([]);
  },

  // The default `page` is already a guest (no storageState in the project
  // config); this alias just makes intent explicit at the call site.
  guestPage: async ({ page }, use) => {
    await use(page);
  },

  customerPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: STORAGE.customer });
    const page = await ctx.newPage();
    const watcher = watchConsole(page);
    await use(page);
    baseExpect(
      watcher.errors,
      `Console errors (customer) on ${page.url()}:\n${watcher.errors.join("\n")}`,
    ).toEqual([]);
    await ctx.close();
  },

  adminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: STORAGE.admin });
    const page = await ctx.newPage();
    const watcher = watchConsole(page);
    await use(page);
    baseExpect(
      watcher.errors,
      `Console errors (admin) on ${page.url()}:\n${watcher.errors.join("\n")}`,
    ).toEqual([]);
    await ctx.close();
  },
});

export const expect = baseExpect;
