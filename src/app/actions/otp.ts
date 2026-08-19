"use server";

import { createHash, randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { limitByIp, rateLimitShared } from "@/lib/rate-limit";
import { sendOtpSms, normalisePhone } from "@/lib/sms";
import type { SimpleActionState } from "@/lib/form-state";

/**
 * Phone-OTP login, step one: request a code.
 *
 * Security posture:
 *  - Only the sha256 of the code is stored; the code exists nowhere but the
 *    SMS (or the server console in mock mode).
 *  - Requesting a new code consumes every outstanding one, so exactly one
 *    code is live per phone at any moment.
 *  - Two rate limits guard the send: per-IP (a botnet burning our SMS
 *    balance) and per-phone (SMS-pumping fraud against premium numbers, the
 *    classic OTP-endpoint attack). Verification attempts are capped at 5
 *    per code in the provider.
 */

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_S = 30;

// Type-only export — constants must NOT be exported from a "use server"
// module (they compile to server-reference proxies and break the build).
export type OtpRequestState = SimpleActionState & { retryAfter?: number };

export async function requestLoginOtp(
  _prev: OtpRequestState,
  formData: FormData,
): Promise<OtpRequestState> {
  const phone = normalisePhone(String(formData.get("phone") ?? ""));
  if (!phone) {
    return { ok: false, message: "Enter a valid 10-digit Indian mobile number." };
  }

  const byIp = await limitByIp("otp-ip", 8, 15 * 60_000);
  if (!byIp.ok) {
    return {
      ok: false,
      message: `Too many attempts from this connection. Try again in ${Math.ceil(byIp.retryAfter / 60)} min.`,
      retryAfter: byIp.retryAfter,
    };
  }

  // Shared, not per-instance: three codes per number means three in total,
  // not three per function instance that happens to serve the request.
  const byPhone = await rateLimitShared(`otp-phone:${phone}`, 3, 15 * 60_000);
  if (!byPhone.ok) {
    return {
      ok: false,
      message: `That number has had a few codes already. Try again in ${Math.ceil(byPhone.retryAfter / 60)} min.`,
      retryAfter: byPhone.retryAfter,
    };
  }

  // Resend cooldown, judged against the newest live code.
  const latest = await prisma.phoneOtp.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (latest) {
    const since = (Date.now() - latest.createdAt.getTime()) / 1000;
    if (since < RESEND_COOLDOWN_S) {
      const wait = Math.ceil(RESEND_COOLDOWN_S - since);
      return {
        ok: false,
        message: `A code is already on its way. You can resend in ${wait}s.`,
        retryAfter: wait,
      };
    }
  }

  // randomInt is cryptographically sourced; 6 digits, never leading-zero-trimmed.
  const code = String(randomInt(100000, 1000000));
  const codeHash = createHash("sha256").update(code).digest("hex");

  await prisma.$transaction([
    prisma.phoneOtp.updateMany({
      where: { phone, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.phoneOtp.create({
      data: { phone, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    }),
  ]);

  const sent = await sendOtpSms(phone, code);
  if (!sent.ok) {
    return { ok: false, message: "The SMS couldn't be sent. Try again in a moment." };
  }

  return {
    ok: true,
    message: `Code sent to +91 ${phone.slice(0, 5)} ${phone.slice(5)}. It works for 5 minutes.`,
    retryAfter: RESEND_COOLDOWN_S,
  };
}
