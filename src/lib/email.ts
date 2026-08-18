import { Resend } from "resend";
import { env, integrations, siteUrl } from "./env";

/**
 * Transactional email.
 *
 * TWO PROVIDERS, AND THE REASON THERE ARE TWO
 *
 * Resend verifies a DOMAIN. Until one is verified its sandbox sender delivers
 * only to the account holder, so on a store that has not bought its domain yet,
 * every customer receipt silently goes nowhere.
 *
 * Brevo verifies a single SENDER ADDRESS. A Gmail address can be verified in
 * minutes and reaches real customers immediately. That is the whole reason it
 * is here: it unblocks order confirmations before the domain exists.
 *
 * Resend wins when both are set, because once a domain IS verified it is the
 * better answer — mail signed by your own domain rather than sent on behalf of
 * a gmail.com address that cannot DKIM-align.
 *
 * MOCK MODE (neither key set): every message is printed to the server console
 * in full, including password-reset links. That keeps the entire auth and order
 * flow testable before either provider exists — the reset link is
 * copy-pasteable straight out of the terminal.
 *
 * Sending never throws into the caller. A failed receipt must not roll back a
 * paid order, so failures are logged and swallowed.
 */

const resend = integrations.resend ? new Resend(env.RESEND_API_KEY) : null;

type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
};

/**
 * Splits `Avenues <hi@example.com>` into the shape Brevo wants.
 *
 * Resend takes the RFC 5322 string as-is; Brevo insists on `{ name, email }`.
 * One EMAIL_FROM serves both rather than making the operator keep two
 * spellings of the same address in step.
 */
function parseFrom(value: string) {
  const m = value.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  if (m) return { name: m[1] || undefined, email: m[2]! };
  return { name: undefined, email: value.trim() };
}

/**
 * Brevo's transactional endpoint, over plain fetch.
 *
 * Deliberately no SDK. The call is one POST with a JSON body, and @getbrevo/brevo
 * pulls a large generated client to wrap it — a dependency to audit, update and
 * ship for something `fetch` already does.
 *
 * Brevo is here because of one difference that decides everything before a
 * domain is bought: it verifies a single SENDER ADDRESS, so a Gmail address can
 * send to real customers today. Resend verifies DOMAINS, and until one is
 * verified its sandbox sender delivers only to the account holder.
 */
async function sendViaBrevo({ to, subject, html, replyTo }: SendArgs) {
  const from = parseFrom(env.EMAIL_FROM);
  const recipients = (Array.isArray(to) ? to : [to]).map((email) => ({ email }));

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": env.BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: from,
      to: recipients,
      subject,
      htmlContent: html,
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
    }),
  });

  if (!res.ok) {
    // Brevo puts the actionable part in the body, not the status. The most
    // common failure by far is an unverified sender, and the body says so.
    const detail = await res.text().catch(() => "");
    console.error(`[email] brevo rejected the send (${res.status}): ${detail}`);
    return { ok: false as const, mocked: false as const };
  }

  return { ok: true as const, mocked: false as const };
}

export async function sendEmail({ to, subject, html, replyTo }: SendArgs) {
  // A caller's own reply-to wins; otherwise fall back to the configured
  // inbox. Applied here rather than at each call site so no future message can
  // be sent from a no-mailbox address with nowhere for the answer to go.
  const reply = replyTo || env.EMAIL_REPLY_TO || undefined;
  if (!resend && integrations.brevo) {
    try {
      return await sendViaBrevo({ to, subject, html, replyTo: reply });
    } catch (err) {
      console.error("[email] brevo send threw:", err);
      return { ok: false as const, mocked: false as const };
    }
  }

  if (!resend) {
    const recipients = Array.isArray(to) ? to.join(", ") : to;
    console.info(
      [
        "",
        "───── EMAIL (mock mode — no RESEND_API_KEY or BREVO_API_KEY) ─────",
        `To:      ${recipients}`,
        `Subject: ${subject}`,
        reply ? `Reply-to: ${reply}` : null,
        "",
        stripTags(html),
        "───────────────────────────────────────────────────────────────",
        "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    return { ok: true as const, mocked: true as const };
  }

  try {
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(reply ? { replyTo: reply } : {}),
    });
    if (result.error) {
      console.error("[email] send failed:", result.error);
      return { ok: false as const, mocked: false as const };
    }
    return { ok: true as const, mocked: false as const };
  } catch (err) {
    console.error("[email] send threw:", err);
    return { ok: false as const, mocked: false as const };
  }
}

function stripTags(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|tr|h1|h2|h3|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8377;|&rupee;/g, "₹")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Email HTML has to survive Outlook and Gmail, so this is deliberately
 * table-based with inline styles and no webfonts. The monogram is drawn as an
 * inline SVG data URI — clients that block remote images still show the mark.
 */
/**
 * The real lockup, hosted on the CDN.
 *
 * Not typed text: the header used to set "AVENUES" in letter-spaced Georgia,
 * which is a decent impression of the wordmark and visibly not it. The supplied
 * artwork has its own letterforms and its gold gradient.
 *
 * Not a data: URI either — Gmail strips those from <img>, so an inlined logo
 * arrives as a broken image in the client that matters most. A hosted URL is
 * the only form that renders.
 *
 * These live under avenues/email/ rather than in the product folder the admin
 * panel manages, because already-delivered mail can be opened years from now
 * and tidying up product images must never be able to blank the brand mark out
 * of every receipt ever sent.
 *
 * The mark carries alt="" and the wordmark alt="Avenues", so a client with
 * images off shows the brand name once rather than twice or not at all.
 */
const CDN = "https://res.cloudinary.com/kvmlr7s8/image/upload";
const LOGO_MARK = `${CDN}/avenues/email/logo-mark.png`;
const LOGO_WORDMARK = `${CDN}/avenues/email/logo-wordmark.png`;

export function emailShell(opts: {
  preheader: string;
  heading: string;
  body: string;
  cta?: { label: string; href: string };
  footerNote?: string;
}) {
  const { preheader, heading, body, cta, footerNote } = opts;

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0B0B0D;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0B0D;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141416;border:1px solid #232327;">
        <tr><td align="center" style="padding:36px 32px 8px;">
          <img src="${LOGO_MARK}" width="72" height="58" alt=""
               style="display:block;margin:0 auto 14px;border:0;outline:none;text-decoration:none;">
          <img src="${LOGO_WORDMARK}" width="190" height="20" alt="Avenues"
               style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;">
          <div style="font:400 9px/1 Arial,sans-serif;letter-spacing:.36em;text-transform:uppercase;color:#C9A24B;padding-top:10px;">Perfumes</div>
        </td></tr>
        <tr><td style="padding:8px 32px 0;">
          <div style="height:1px;background:#232327;margin:24px 0 28px;"></div>
          <h1 style="margin:0 0 18px;font:300 26px/1.25 Georgia,'Times New Roman',serif;color:#F2EDE3;">${escapeHtml(heading)}</h1>
          <div style="font:400 15px/1.7 Arial,sans-serif;color:#9A938A;">${body}</div>
        </td></tr>
        ${
          cta
            ? `<tr><td style="padding:28px 32px 4px;">
                 <a href="${cta.href}" style="display:inline-block;background:#C9A24B;color:#0B0B0D;text-decoration:none;font:500 11px/1 Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;padding:16px 30px;">${escapeHtml(cta.label)}</a>
               </td></tr>`
            : ""
        }
        <tr><td style="padding:32px;">
          <div style="height:1px;background:#232327;margin-bottom:20px;"></div>
          <p style="margin:0;font:400 12px/1.7 Arial,sans-serif;color:#868075;">
            ${footerNote ? `${escapeHtml(footerNote)}<br><br>` : ""}
            Avenues Perfumes &middot; <a href="${siteUrl}" style="color:#C9A24B;text-decoration:none;">${siteUrl.replace(/^https?:\/\//, "")}</a><br>
            Questions? Reply to this email and a person will answer.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
