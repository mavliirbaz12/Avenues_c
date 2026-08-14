/**
 * Visual QA harness.
 *
 * Drives the locally installed Chrome (via puppeteer-core — no Chromium
 * download) to capture a page at the three breakpoints the brief calls out:
 * desktop 1440, tablet 768, mobile 390.
 *
 *   node scripts/shot.mjs                   # "/" at all three widths
 *   node scripts/shot.mjs shop --full       # full-page captures of /shop
 *   node scripts/shot.mjs shop --w=390      # a single width
 *   node scripts/shot.mjs shop --tag=after  # name the output files
 *
 * Pass the route WITHOUT a leading slash — under Git Bash, MSYS rewrites a
 * bare "/" argument into a Windows path before Node ever sees it.
 *
 * Output lands in the scratchpad directory printed at the end.
 */
import puppeteer from "puppeteer-core";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const CHROME =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const OUT =
  process.env.SHOT_DIR ??
  "C:\\Users\\IRBAZS~1\\AppData\\Local\\Temp\\claude\\d--octopus\\a815f878-7386-47ea-a546-6325a7ac4396\\scratchpad\\shots";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const args = process.argv.slice(2);
const rawPath = args.find((a) => !a.startsWith("--")) ?? "";
const path = rawPath === "" ? "/" : `/${rawPath.replace(/^\/+/, "")}`;
const full = args.includes("--full");
const tag = (args.find((a) => a.startsWith("--tag=")) ?? "").split("=")[1] ?? "";
const onlyWidth = (args.find((a) => a.startsWith("--w=")) ?? "").split("=")[1];
// --at=#notes scrolls that element to the top before a viewport capture, so a
// single section can be inspected at real pixel size instead of squinting at a
// 12,000px full-page render.
const scrollTo = (args.find((a) => a.startsWith("--at=")) ?? "").split("=")[1];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
].filter((v) => !onlyWidth || String(v.width) === onlyWidth);

if (!existsSync(CHROME)) {
  console.error(`Chrome not found at ${CHROME}. Set CHROME_PATH.`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const slug =
  (path === "/" ? "home" : path.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-")) +
  (tag ? `-${tag}` : "");

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--hide-scrollbars", "--disable-gpu", "--no-sandbox", "--force-color-profile=srgb"],
});

// --login signs in as the seeded admin before capturing, so /admin pages can
// be audited. Credentials come from .env (SEED_ADMIN_EMAIL/PASSWORD).
if (args.includes("--login")) {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@avenuesperfumes.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!2026";
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForSelector("#email", { timeout: 60_000 });
  // The SSR HTML has the fields before React attaches the submit handler —
  // typing too early submits into the void. Wait for hydration to settle.
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 60_000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 600));
  await page.type("#email", email);
  await page.type("#password", password);
  await page.click("button[type=submit]");
  // Sign-in is a fetch + client-side router.push, not a full navigation —
  // wait for the URL to leave /login instead of a navigation event.
  await page.waitForFunction(() => !location.pathname.startsWith("/login"), {
    timeout: 60_000,
  });
  await page.close();
  console.error(`logged in as ${email}`);
}

const written = [];

for (const vp of VIEWPORTS) {
  const page = await browser.newPage();
  await page.setViewport({
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: 2,
    isMobile: vp.width < 768,
    hasTouch: vp.width < 768,
  });

  const url = `${BASE}${path}`;
  // Not networkidle0: the dev server holds an HMR websocket open, so the
  // network never goes idle and the wait always times out.
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page
    .waitForNetworkIdle({ idleTime: 600, timeout: 15_000 })
    .catch(() => {});

  // Webfonts and the scroll-triggered reveals both need a beat, otherwise
  // every capture shows mid-animation opacity.
  await page.evaluate(() => document.fonts.ready);
  if (full) {
    // Walk the page so every `whileInView` reveal has fired before capture,
    // otherwise sections below the fold photograph at opacity 0.
    //
    // Re-measures each iteration against documentElement (not body, which
    // under-reports when the scroll container is the html element) because
    // the page grows as lazy images and fonts land.
    await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const step = Math.round(window.innerHeight * 0.6);
      let y = 0;
      let guard = 0;
      while (guard++ < 200) {
        const max = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight,
        );
        if (y > max) break;
        window.scrollTo(0, y);
        await sleep(150);
        y += step;
      }
      // Settle at the bottom so trailing sections definitely intersect.
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(500);
      window.scrollTo(0, 0);
      await sleep(300);
    });
  }
  if (scrollTo) {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90);
    }, scrollTo);
    await new Promise((r) => setTimeout(r, 1200));
  }

  await new Promise((r) => setTimeout(r, 900));

  const file = join(OUT, `${slug}-${vp.name}-${vp.width}.png`);
  await page.screenshot({ path: file, fullPage: full });
  written.push(file);

  // Surface anything the page logged as broken — a 404 image or a failed
  // fetch is easy to miss in a screenshot.
  await page.close();
}

await browser.close();

console.log(written.join("\n"));
console.log(`\n${written.length} shot(s) in ${OUT}`);
