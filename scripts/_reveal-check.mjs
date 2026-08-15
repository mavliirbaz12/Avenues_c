/**
 * Verifies the scroll-scrubbed bottle reveal actually scrubs.
 *
 * Screenshots the pinned stage at 0/25/50/75/100% of its scroll runway and
 * hashes each capture. Distinct hashes mean the sequence advanced; identical
 * ones mean the canvas is stuck on one frame, which a single screenshot would
 * never reveal.
 *
 * Usage: node scripts/_reveal-check.mjs [outDir] [width] [height] [--reduced]
 */
import { createHash } from "node:crypto";
import puppeteer from "puppeteer-core";

const CHROME =
  process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const args = process.argv.slice(2);
const OUT = args[0] ?? ".";
const W = Number(args[1] ?? 1440);
const H = Number(args[2] ?? 900);
const REDUCED = args.includes("--reduced");

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

if (REDUCED) {
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
}

const seqRequests = [];
page.on("request", (r) => {
  if (r.url().includes("/sequence/")) seqRequests.push(r.url());
});

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 4500)); // coarse batch

const box = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="bottle-reveal"]');
  if (!el) return null;
  return {
    top: el.getBoundingClientRect().top + window.scrollY,
    height: el.offsetHeight,
    reduced: el.getAttribute("data-reduced") === "true",
  };
});

if (!box) {
  console.error("FAIL: [data-testid=bottle-reveal] not found");
  await browser.close();
  process.exit(1);
}

const label = REDUCED ? "reduced" : `${W}`;
console.log(
  `section: top=${Math.round(box.top)} height=${box.height} viewport=${H} reducedFallback=${box.reduced}`,
);

if (REDUCED) {
  await page.screenshot({ path: `${OUT}/reveal-reduced.png` });
  // Exactly one is correct: the fallback renders the final frame as a plain
  // <img> so the section still shows the bottle. What must not happen is the
  // sequence loading — anything above 1 means the scrub mounted anyway.
  const ok = box.reduced && seqRequests.length <= 1;
  console.log(`sequence requests under reduced motion: ${seqRequests.length} (expected <= 1)`);
  console.log(
    ok
      ? "PASS: static fallback only, sequence not loaded"
      : `FAIL: reducedFallback=${box.reduced}, fetched ${seqRequests.length} frames`,
  );
  await browser.close();
  process.exit(ok ? 0 : 1);
}

const hashes = [];
for (const pct of [0, 0.25, 0.5, 0.75, 1]) {
  const y = box.top + (box.height - H) * pct;
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await new Promise((r) => setTimeout(r, 1500));
  const buf = await page.screenshot({
    path: `${OUT}/reveal-${label}-${Math.round(pct * 100)}.png`,
  });
  hashes.push(createHash("md5").update(buf).digest("hex").slice(0, 10));
}

// Scroll back up: the sequence must reverse, not stay at the end.
await page.evaluate((yy) => window.scrollTo(0, yy), box.top);
await new Promise((r) => setTimeout(r, 1800));
const backBuf = await page.screenshot({ path: `${OUT}/reveal-${label}-back.png` });
const backHash = createHash("md5").update(backBuf).digest("hex").slice(0, 10);

console.log(`hashes 0/25/50/75/100: ${hashes.join(" ")}`);
console.log(`distinct: ${new Set(hashes).size}/${hashes.length}`);
console.log(`after scrolling back to 0%: ${backHash} (start was ${hashes[0]})`);
console.log(`sequence requests: ${seqRequests.length}`);

const advanced = new Set(hashes).size >= 4;
const reversed = backHash === hashes[0];
console.log(advanced ? "PASS: sequence advances" : "FAIL: frames did not advance");
console.log(reversed ? "PASS: sequence reverses" : "WARN: reverse did not return to frame 0");

await browser.close();
process.exit(advanced ? 0 : 1);
