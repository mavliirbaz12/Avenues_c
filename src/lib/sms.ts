import { env, integrations } from "./env";

/**
 * SMS delivery, mock-first like every other integration here.
 *
 * MOCK MODE (no MSG91_AUTH_KEY): the message — including the OTP — prints to
 * the server console, so the whole phone-login flow is walkable before any
 * SMS account exists.
 *
 * LIVE: MSG91 Flow API. India requires DLT registration (TRAI): a one-time
 * sender-ID + template approval through an operator portal, which MSG91
 * walks you through. The template must contain an ##otp## variable and its
 * approved ID goes in MSG91_TEMPLATE_ID.
 *
 * Sending never throws to the caller — a delivery hiccup surfaces as
 * { ok: false } so the action can tell the user to retry, and the code
 * stored in the database simply expires unused.
 */

export const smsLive = integrations.sms;

export async function sendOtpSms(phone10: string, otp: string): Promise<{ ok: boolean }> {
  if (!smsLive) {
    console.info(
      [
        "",
        "──────────── SMS (mock mode — no MSG91_AUTH_KEY) ────────────",
        `To:   +91 ${phone10}`,
        `Body: ${otp} is your Avenues sign-in code. Valid for 5 minutes.`,
        `OTP:  ${otp}`,
        "─────────────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return { ok: true };
  }

  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: env.MSG91_AUTH_KEY,
      },
      body: JSON.stringify({
        template_id: env.MSG91_TEMPLATE_ID,
        short_url: "0",
        recipients: [{ mobiles: `91${phone10}`, otp }],
      }),
    });

    const data = (await res.json().catch(() => null)) as { type?: string } | null;
    if (!res.ok || data?.type === "error") {
      console.error("[sms] MSG91 send failed:", res.status, data);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error("[sms] MSG91 send threw:", err);
    return { ok: false };
  }
}

/** "+91 98765-43210" → "9876543210"; empty string when it isn't an Indian mobile. */
export function normalisePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(ten) ? ten : "";
}
