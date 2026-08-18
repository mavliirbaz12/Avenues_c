import { defineConfig, devices } from "@playwright/test";
import { testEnv, TEST_BASE_URL } from "./e2e/utils/env";

/**
 * E2E configuration for Avenues.
 *
 * Runs against a PRODUCTION build (`next start`), not the dev server. Dev mode
 * compiles per route on demand, double-renders under StrictMode and skips
 * <Link> prefetch — none of which is what ships, and all of which changes
 * timing enough to hide real races.
 *
 * The app is pointed at a separate `avenues_test` database via `webServer.env`
 * rather than an env file, because Next's own env resolution differs between
 * dev and start and we do not want the dev database one typo away from being
 * wiped by a seed.
 *
 * Auth is handled by the `setup` project, which signs in once through the real
 * login form and saves storage state for the rest of the suite to reuse.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.artifacts",
  snapshotDir: "./e2e/.snapshots",

  // A test that needs more than 60s is stuck, not slow.
  timeout: 60_000,
  expect: { timeout: 10_000 },

  fullyParallel: true,
  // Tests mutate shared rows (stock, orders, settings), so a stray `.only`
  // slipping into CI would silently shrink the suite.
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Serial locally: the suite shares one database and one store-settings row.
  // Parallel workers racing on settings toggles cause exactly the flakiness
  // this suite exists to catch elsewhere.
  workers: process.env.CI ? 2 : 1,

  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }], ["list"]]
    : [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: TEST_BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "chromium-desktop",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      // @mobile marks specs about the small-viewport layout — the hamburger
      // menu, the sticky buy bar — which do not exist at 1440px.
      grepInvert: /@mobile/,
      // The journey has its own project: it is one serial session and would be
      // a different, slower test if it ran twice alongside everything else.
      testIgnore: /journey\//,
    },
    {
      name: "mobile",
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"] },
      // The admin panel is a desktop tool; running its specs at 412px tests a
      // layout nobody uses. Storefront and checkout run on both. The journey
      // has its own project.
      testIgnore: [/admin\//, /journey\//],
      // @desktop marks assertions about affordances that only exist on wide
      // viewports — the nav's text labels (hidden below 1400px by design) and
      // the hover-opened Fragrances menu. Mobile has its own equivalents in
      // storefront/mobile-nav.spec.ts rather than these being skipped blind.
      grepInvert: /@desktop/,
    },
    {
      // The end-to-end customer journey: signup through to a tracked order, in
      // one session, screenshotted at every stage. Deliberately standalone —
      // it signs itself up rather than reusing the `setup` project's storage
      // state, because "does signing up work" is the second thing it asserts.
      // Run it alone with `npm run test:e2e:journey`.
      name: "journey",
      testMatch: /journey\/.*\.spec\.ts/,
      fullyParallel: false,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],

  webServer: {
    // Not a bare `next start`: the wrapper tees the server console to
    // E2E_SERVER_LOG so specs can read the transactional mail the app printed
    // in mock mode. Nothing else about the server changes.
    command: "npm run start:e2e",
    url: TEST_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: testEnv(),
  },
});
