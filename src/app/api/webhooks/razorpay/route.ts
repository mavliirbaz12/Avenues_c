import { NextResponse, type NextRequest } from "next/server";
import { PaymentStatus, RefundStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";
import { confirmOrder, markPaymentFailed } from "@/lib/commerce/orders";

export const dynamic = "force-dynamic";

/**
 * Razorpay webhook.
 *
 * The signature is verified against the RAW request body — parsing first and
 * re-serialising would change the bytes and always fail. Every handler is
 * idempotent (confirmOrder gates on status; refund updates match on the
 * gateway id), because Razorpay retries delivery and may send events out of
 * order relative to the browser's verify call.
 *
 * Always answer 200 for events we understand but choose to ignore — a non-2xx
 * makes Razorpay retry forever.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    // 401 (not 200): a bad signature is the one case that must NOT be
    // swallowed, or a forged event would be silently accepted as handled.
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: {
    event?: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
          method?: string;
          error_code?: string | null;
          error_description?: string | null;
        };
      };
      refund?: { entity?: { id?: string; payment_id?: string; status?: string } };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed body." }, { status: 400 });
  }

  const kind = event.event ?? "";

  try {
    switch (kind) {
      case "payment.captured":
      case "order.paid": {
        const entity = event.payload?.payment?.entity;
        const razorpayOrderId = entity?.order_id;
        if (!razorpayOrderId) break;

        const payment = await prisma.payment.findUnique({
          where: { razorpayOrderId },
          select: { orderId: true },
        });
        if (!payment) break; // an order from another system/test — ack and move on

        await confirmOrder(payment.orderId, {
          paidNow: true,
          razorpayPaymentId: entity?.id,
          paymentRaw: event,
        });

        if (entity?.method) {
          await prisma.payment.updateMany({
            where: { razorpayOrderId },
            data: { method: entity.method },
          });
        }
        break;
      }

      case "payment.failed": {
        const entity = event.payload?.payment?.entity;
        if (!entity?.order_id) break;
        await markPaymentFailed({
          razorpayOrderId: entity.order_id,
          errorCode: entity.error_code,
          errorDescription: entity.error_description,
          raw: event,
        });
        break;
      }

      case "refund.processed": {
        const entity = event.payload?.refund?.entity;
        if (!entity?.id) break;
        await prisma.refund.updateMany({
          where: { razorpayRefundId: entity.id },
          data: { status: RefundStatus.PROCESSED, processedAt: new Date() },
        });
        // Reflect on the order's payment status.
        const refund = await prisma.refund.findUnique({
          where: { razorpayRefundId: entity.id },
          select: { orderId: true, amountPaise: true, order: { select: { totalPaise: true } } },
        });
        if (refund) {
          await prisma.order.update({
            where: { id: refund.orderId },
            data: {
              paymentStatus:
                refund.amountPaise >= refund.order.totalPaise
                  ? PaymentStatus.REFUNDED
                  : PaymentStatus.PARTIALLY_REFUNDED,
            },
          });
        }
        break;
      }

      default:
        // Unsubscribed or future event — acknowledge so Razorpay stops retrying.
        break;
    }
  } catch (err) {
    console.error(`[webhook:razorpay] handling ${kind} failed:`, err);
    // 500 so Razorpay retries — our handlers are idempotent, so a retry after
    // a transient DB error is safe and desirable.
    return NextResponse.json({ error: "Handler error." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
