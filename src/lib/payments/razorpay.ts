import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env, integrations } from "@/lib/env";

/**
 * Razorpay client with a first-class MOCK MODE.
 *
 * No keys configured ⇒ order creation returns a synthetic order id and the
 * checkout page routes to /checkout/mock-pay, which simulates the gateway —
 * success and failure both — so the entire order lifecycle is testable
 * before the founder has a Razorpay account. Mock verification is accepted
 * ONLY while mock mode is active; the moment real keys land in .env, every
 * mock path returns false.
 */

export const razorpayLive = integrations.razorpay;

const client = razorpayLive
  ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET })
  : null;

export const MOCK_ORDER_PREFIX = "order_mock_";
export const MOCK_PAYMENT_PREFIX = "pay_mock_";
export const MOCK_SIGNATURE = "mock_signature_ok";

/** Creates a gateway order for the given amount. */
export async function createGatewayOrder(args: {
  amountPaise: number;
  receipt: string; // our order number
  notes?: Record<string, string>;
}): Promise<{ razorpayOrderId: string; mock: boolean }> {
  if (!client) {
    return {
      razorpayOrderId: `${MOCK_ORDER_PREFIX}${args.receipt}_${Date.now().toString(36)}`,
      mock: true,
    };
  }

  const order = await client.orders.create({
    amount: args.amountPaise, // Razorpay wants paise; our whole codebase is paise
    currency: "INR",
    receipt: args.receipt,
    notes: args.notes,
  });

  return { razorpayOrderId: order.id, mock: false };
}

/**
 * Verifies the signature Checkout.js hands back after a successful payment:
 * HMAC-SHA256(order_id + "|" + payment_id, key_secret).
 */
export function verifyPaymentSignature(args: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): boolean {
  if (!razorpayLive) {
    // Mock mode: accept only the sentinel signature for mock ids.
    return (
      args.razorpayOrderId.startsWith(MOCK_ORDER_PREFIX) &&
      args.razorpayPaymentId.startsWith(MOCK_PAYMENT_PREFIX) &&
      args.signature === MOCK_SIGNATURE
    );
  }

  const expected = createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${args.razorpayOrderId}|${args.razorpayPaymentId}`)
    .digest("hex");

  return safeCompare(expected, args.signature);
}

/** Verifies the X-Razorpay-Signature header on a webhook body. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;

  const expected = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  return safeCompare(expected, signature);
}

/** Issues a refund for a captured payment. */
export async function refundPayment(args: {
  razorpayPaymentId: string;
  amountPaise: number;
  notes?: Record<string, string>;
}): Promise<{ refundId: string; mock: boolean; raw: unknown }> {
  if (!client) {
    return {
      refundId: `rfnd_mock_${Date.now().toString(36)}`,
      mock: true,
      raw: { mock: true, ...args },
    };
  }

  const refund = await client.payments.refund(args.razorpayPaymentId, {
    amount: args.amountPaise,
    speed: "normal",
    notes: args.notes,
  });

  return { refundId: refund.id, mock: false, raw: refund };
}

function safeCompare(a: string, b: string) {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
