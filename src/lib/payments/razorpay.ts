import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env, integrations, isProd } from "@/lib/env";
import { MOCK_ORDER_PREFIX, MOCK_PAYMENT_PREFIX, MOCK_SIGNATURE } from "./mock-constants";

/**
 * Razorpay client with a first-class MOCK MODE.
 *
 * No keys configured ⇒ order creation returns a synthetic order id and the
 * checkout page routes to /checkout/mock-pay, which simulates the gateway —
 * success and failure both — so the entire order lifecycle is testable
 * before the founder has a Razorpay account. Mock verification is accepted
 * ONLY while mock mode is active; the moment real keys land in .env, every
 * mock path returns false.
 *
 * MOCK MODE IS DEVELOPMENT-ONLY, ENFORCED HERE RATHER THAN BY CONVENTION.
 *
 * The sentinels below are public: `mock-constants.ts` is imported by the
 * "use client" mock-pay page, so `mock_signature_ok` ships in the browser
 * bundle. That is fine on a laptop and a free-order machine on the internet.
 * The old code decided mock vs live *only* on whether two env vars happened to
 * be non-empty, which meant a deploy that simply forgot them — the default
 * state of a Vercel Preview, where secrets are routinely set for Production
 * only — accepted `mock_signature_ok` as proof of payment from any anonymous
 * visitor, decremented real stock and burned a real GST invoice number.
 *
 * Missing credentials now fail CLOSED. A production build with no keys refuses
 * to mint mock gateway orders and refuses to verify mock signatures, so there
 * is no exploitable Payment row to attack and no branch that accepts the
 * sentinel. Set `ALLOW_MOCK_PAYMENTS=1` to deliberately re-enable it (a staging
 * box demoing the flow without a Razorpay account); never set it in production.
 */

export const razorpayLive = integrations.razorpay;

/**
 * Whether the mock gateway may be used at all.
 *
 * Deliberately not just `!razorpayLive`: absent credentials must disable taking
 * payment, not disable *checking* it.
 */
export const mockPaymentsAllowed =
  !razorpayLive && (!isProd || process.env.ALLOW_MOCK_PAYMENTS === "1");

const client = razorpayLive
  ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET })
  : null;

export { MOCK_ORDER_PREFIX, MOCK_PAYMENT_PREFIX, MOCK_SIGNATURE } from "./mock-constants";

/** Creates a gateway order for the given amount. */
export async function createGatewayOrder(args: {
  amountPaise: number;
  receipt: string; // our order number
  notes?: Record<string, string>;
}): Promise<{ razorpayOrderId: string; mock: boolean }> {
  if (!client) {
    // The strongest of the three guards: with no mock Payment row in the
    // database there is nothing for /api/payments/verify to match against, so
    // the bypass has no entry point even if a later refactor loosens the check
    // below.
    if (!mockPaymentsAllowed) {
      throw new Error(
        "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET — " +
          "refusing to create a mock gateway order in production.",
      );
    }
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
    // Mock mode: accept only the sentinel signature for mock ids — and only
    // where mock mode is permitted at all. Without the second condition this
    // single `return` is the whole of the payment authorisation on a keyless
    // production deploy.
    if (!mockPaymentsAllowed) return false;
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
