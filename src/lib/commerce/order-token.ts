import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Guest order access tokens.
 *
 * A guest has no session, but must be able to open their success page and
 * tracking timeline from the confirmation email. Instead of a database column
 * we derive a token: HMAC-SHA256(orderId, AUTH_SECRET), truncated. It proves
 * the bearer got the link from us (the email or the checkout redirect), can't
 * be guessed from an order number, and needs no storage or expiry bookkeeping
 * — it is exactly as durable as the order itself, which is what a "view your
 * order" link should be.
 */
export function orderAccessToken(orderId: string) {
  return createHmac("sha256", env.AUTH_SECRET).update(`order:${orderId}`).digest("hex").slice(0, 32);
}

export function verifyOrderAccessToken(orderId: string, token: string | null | undefined) {
  if (!token) return false;
  const expected = orderAccessToken(orderId);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
