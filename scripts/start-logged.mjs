/**
 * `next start` with its output teed to a file.
 *
 *   node scripts/start-logged.mjs
 *
 * Exists for one reason: in mock mode `sendEmail` prints every message to the
 * server console (see src/lib/email.ts), and that console is the only record
 * a transactional email was ever produced — nothing is persisted. Playwright
 * pipes `webServer` output to its own stdout, where a spec cannot read it, so
 * the server writes a copy to E2E_SERVER_LOG and e2e/utils/mailbox.ts reads it
 * back. That turns "a receipt is on its way" from a claim the page makes about
 * itself into something the suite can actually verify.
 *
 * The file is truncated on boot so a run never asserts against a previous
 * run's mail.
 */
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const LOG = process.env.E2E_SERVER_LOG ?? "e2e/.artifacts/server.log";

mkdirSync(dirname(LOG), { recursive: true });
writeFileSync(LOG, "");
const log = createWriteStream(LOG, { flags: "a" });

const child = spawn("npx", ["next", "start"], {
  // Windows needs a shell to resolve `npx`; POSIX does not and is safer without.
  shell: process.platform === "win32",
  env: process.env,
  stdio: ["inherit", "pipe", "pipe"],
});

const tee = (from, to) =>
  from.on("data", (chunk) => {
    to.write(chunk);
    log.write(chunk);
  });

tee(child.stdout, process.stdout);
tee(child.stderr, process.stderr);

// Playwright kills the process tree on teardown, but a plain Ctrl-C run should
// not leave `next start` holding the port either.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  log.end();
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});

child.on("error", (err) => {
  console.error("[start-logged] could not start next:", err);
  process.exit(1);
});
