/**
 * End-to-end proof of the phone-OTP login in mock mode:
 *  1. open /login, switch to the Phone OTP tab, request a code
 *  2. read the code out of the dev-server log (mock SMS prints it)
 *  3. type it, verify, and confirm we land signed-in on /account
 *
 * Usage: node scripts/otp-e2e.mjs <dev-server-log-file>
 */
import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";

const LOG = process.argv[2];
const PHONE = "9955443322";
const B = "http://localhost:3000";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();

await page.goto(`${B}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForSelector("#otp-phone", { timeout: 60000 });
// Hydration gate — same lesson as the admin login script.
await page.waitForNetworkIdle({ idleTime: 800, timeout: 60000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 600));

await page.type("#otp-phone", PHONE);
await page.click("button[type=submit]");
await page.waitForSelector("#otp-code", { timeout: 60000 });
console.log("step 1 ok: code entry visible");

// Harvest the newest OTP for this phone from the mock-SMS console block.
await new Promise((r) => setTimeout(r, 800));
const log = readFileSync(LOG, "utf8");
const blocks = [...log.matchAll(/To:\s+\+91 (\d{10})[\s\S]*?OTP:\s+(\d{6})/g)];
const mine = blocks.filter((m) => m[1] === PHONE).pop();
if (!mine) {
  console.error("FAIL: no OTP found in server log for", PHONE);
  process.exit(1);
}
const otp = mine[2];
console.log("step 2 ok: harvested OTP", otp);

// Wrong code first — must be rejected.
await page.type("#otp-code", "000000");
await page.click("button[type=submit]");
await page.waitForSelector('[role="alert"]', { timeout: 30000 });
console.log("step 3 ok: wrong code rejected");

// Now the real one.
await page.click("#otp-code", { clickCount: 3 });
await page.type("#otp-code", otp);
await page.click("button[type=submit]");
await page.waitForFunction(() => location.pathname.startsWith("/account"), {
  timeout: 60000,
});

const who = await page.evaluate(() =>
  document.querySelector("main p.mt-2")?.textContent?.trim(),
);
console.log("step 4 ok: signed in, landed on", await page.evaluate(() => location.pathname));
console.log("account header line:", who);

await browser.close();
console.log("OTP E2E PASSED");
