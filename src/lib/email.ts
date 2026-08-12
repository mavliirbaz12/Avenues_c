import { Resend } from "resend";
import { env, integrations, siteUrl } from "./env";

/**
 * Transactional email.
 *
 * MOCK MODE (no RESEND_API_KEY): every message is printed to the server
 * console in full, including password-reset links. That keeps the entire auth
 * and order flow testable before a domain is verified — the reset link is
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

export async function sendEmail({ to, subject, html, replyTo }: SendArgs) {
  if (!resend) {
    const recipients = Array.isArray(to) ? to.join(", ") : to;
    console.info(
      [
        "",
        "──────────── EMAIL (mock mode — no RESEND_API_KEY) ────────────",
        `To:      ${recipients}`,
        `Subject: ${subject}`,
        replyTo ? `Reply-to: ${replyTo}` : null,
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
      ...(replyTo ? { replyTo } : {}),
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
          <div style="font:300 22px/1 Georgia,'Times New Roman',serif;letter-spacing:.36em;text-transform:uppercase;color:#F2EDE3;">Avenues</div>
          <div style="font:400 9px/1 Arial,sans-serif;letter-spacing:.36em;text-transform:uppercase;color:#C9A24B;padding-top:8px;">Perfumes</div>
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
          <p style="margin:0;font:400 12px/1.7 Arial,sans-serif;color:#6B655D;">
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
