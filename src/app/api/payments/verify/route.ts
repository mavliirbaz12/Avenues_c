import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPaymentSignature } from "@/lib/payments/razorpay";
import { confirmOrder } from "@/lib/commerce/orders";
import { orderAccessToken } from "@/lib/commerce/order-token";
import { limitByIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  signature: z.string().min(1),
});

/**
 * Called by the browser after Checkout.js reports success.
 *
 * The signature — HMAC of order_id|payment_id under our key secret — is the
 * proof; nothing else from the client is trusted. The webhook provides the
 * same confirmation independently, so an interrupted redirect still results
 * in a confirmed order.
 */
export async function POST(req: NextRequest) {
  const limit = await limitByIp("pay-verify", 20, 300_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { razorpayOrderId, razorpayPaymentId, signature } = parsed.data;

  if (!verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, signature })) {
    console.warn(`[payments] bad signature for ${razorpayOrderId}`);
    return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId },
    select: { orderId: true, order: { select: { orderNumber: true } } },
  });
  if (!payment) {
    return NextResponse.json({ error: "Unknown payment." }, { status: 404 });
  }

  await confirmOrder(payment.orderId, {
    paidNow: true,
    razorpayPaymentId,
    razorpaySignature: signature,
  });

  return NextResponse.json({
    ok: true,
    orderNumber: payment.order.orderNumber,
    accessToken: orderAccessToken(payment.orderId),
  });
}
