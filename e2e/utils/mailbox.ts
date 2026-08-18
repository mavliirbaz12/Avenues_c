import { existsSync, readFileSync } from "node:fs";
import { expect } from "@playwright/test";

/**
 * Reads the transactional mail the app actually sent.
 *
 * With RESEND_API_KEY blank the app is in mock mode and `sendEmail` prints the
 * whole message to the server console instead of posting it (src/lib/email.ts).
 * Nothing is persisted, so the console is the only evidence a receipt was ever
 * produced. `scripts/start-logged.mjs` tees that console to E2E_SERVER_LOG and
 * this parses it back into messages.
 *
 * The point is to make "a receipt is on its way to you" checkable. Asserting
 * the sentence on the confirmation page only proves the page can render a
 * sentence; asserting the message proves the address, the subject and the
 * order number that left the server.
 */

export const SERVER_LOG = process.env.E2E_SERVER_LOG ?? "e2e/.artifacts/server.log";

export type MockEmail = {
  to: string;
  subject: string;
  body: string;
};

/**
 * True when the app was started through the logging wrapper.
 *
 * With `reuseExistingServer` a developer may already have a plain `next start`
 * on the port, in which case there is no log and the mail assertions have to
 * say so rather than fail for the wrong reason.
 */
export function mailboxAvailable() {
  return existsSync(SERVER_LOG);
}

/**
 * The header line email.ts prints above every mocked message. Escaped rather
 * than pasted so the pattern survives a file being re-saved in another
 * encoding — box-drawing characters are exactly what gets mangled.
 */
const OPENER = /EMAIL \(mock mode[^\n]*\n/g;
const CLOSER = /\n[\u2500]{10,}/;

export function readMailbox(): MockEmail[] {
  if (!existsSync(SERVER_LOG)) return [];

  const text = readFileSync(SERVER_LOG, "utf8");
  const out: MockEmail[] = [];

  OPENER.lastIndex = 0;
  for (let m = OPENER.exec(text); m; m = OPENER.exec(text)) {
    const rest = text.slice(m.index + m[0].length);
    const end = rest.search(CLOSER);
    const block = end === -1 ? rest : rest.slice(0, end);

    const to = /^\s*To:\s*(.+)$/m.exec(block)?.[1]?.trim();
    const subject = /^\s*Subject:\s*(.+)$/m.exec(block)?.[1]?.trim();
    if (!to || !subject) continue;

    // Everything after the header block is the stripped HTML body.
    const bodyStart = block.indexOf(subject) + subject.length;
    out.push({ to, subject, body: block.slice(bodyStart).trim() });
  }

  return out;
}

/** Messages sent to one address, oldest first. */
export function mailFor(address: string): MockEmail[] {
  const wanted = address.toLowerCase();
  return readMailbox().filter((m) =>
    m.to.toLowerCase().split(/,\s*/).includes(wanted),
  );
}

/**
 * Waits for a message matching `subject` to reach `address`.
 *
 * Polled rather than read once: confirmation mail is dispatched after the
 * order transaction commits and the log is a stream, so the API response can
 * beat the write by a few milliseconds.
 */
export async function waitForEmail(
  address: string,
  subject: RegExp,
  timeout = 20_000,
): Promise<MockEmail> {
  let found: MockEmail | undefined;

  await expect
    .poll(
      () => {
        found = mailFor(address).find((m) => subject.test(m.subject));
        return Boolean(found);
      },
      {
        timeout,
        message:
          `No mail to ${address} matching ${subject} in ${SERVER_LOG}.\n` +
          `Seen: ${readMailbox().map((m) => `${m.to} / ${m.subject}`).join(" | ") || "(none)"}`,
      },
    )
    .toBe(true);

  return found!;
}
