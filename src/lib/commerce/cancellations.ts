import { OrderStatus, PaymentMethod, PaymentStatus, RefundStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { refundPayment } from "@/lib/payments/razorpay";
import { sendOrderCancelledEmail } from "./order-emails";

/**
 * Cancellation and refund machinery, shared by the customer's "cancel order"
 * button and the admin panel.
 *
 * Rules:
 *  - Customers can cancel only BEFORE shipment (PENDING/CONFIRMED/PACKED,
 *    per policy PACKED is still cancellable since it hasn't left).
 *  - Cancelling restores any committed stock exactly once, guarded by
 *    stockReleasedAt.
 *  - Prepaid+PAID orders trigger a Razorpay refund; a Refund row tracks it
 *    and the refund.processed webhook flips it to PROCESSED.
 *  - Everything is inside one transaction except the gateway call, which is
 *    made first — if the gateway refuses, nothing local changes.
 */

const CUSTOMER_CANCELLABLE: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PACKED,
];

export class CancelError extends Error {}

export async function cancelOrder(args: {
  orderId: string;
  reason: string;
  by: "customer" | "admin";
}) {
  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
    include: {
      items: { select: { variantId: true, quantity: true } },
      payments: { where: { status: PaymentStatus.PAID }, take: 1 },
    },
  });

  if (!order) throw new CancelError("Order not found.");

  if (args.by === "customer" && !CUSTOMER_CANCELLABLE.includes(order.status)) {
    throw new CancelError(
      "This order has already left us, so it can't be cancelled — but you can request a return once it arrives.",
    );
  }
  if (order.status === OrderStatus.CANCELLED) return { alreadyCancelled: true, refundPaise: null };
  if (
    args.by === "admin" &&
    ([OrderStatus.DELIVERED, OrderStatus.RETURNED] as OrderStatus[]).includes(order.status)
  ) {
    throw new CancelError(`A ${order.status} order can't be cancelled.`);
  }

  // Gateway first: if Razorpay refuses the refund, the order stays untouched
  // and the founder can retry rather than owing an off-books refund.
  const paidPayment = order.paymentStatus === PaymentStatus.PAID ? order.payments[0] : null;
  let gatewayRefund: { refundId: string; raw: unknown } | null = null;

  if (paidPayment?.razorpayPaymentId && order.paymentMethod === PaymentMethod.RAZORPAY) {
    gatewayRefund = await refundPayment({
      razorpayPaymentId: paidPayment.razorpayPaymentId,
      amountPaise: order.totalPaise,
      notes: { orderNumber: order.orderNumber, reason: args.reason.slice(0, 250) },
    });
  }

  const refundPaise = gatewayRefund ? order.totalPaise : null;

  await prisma.$transaction(async (tx) => {
    // Restore stock exactly once.
    const fresh = await tx.order.findUnique({
      where: { id: order.id },
      select: { stockCommittedAt: true, stockReleasedAt: true, status: true },
    });
    if (!fresh || fresh.status === OrderStatus.CANCELLED) return;

    if (fresh.stockCommittedAt && !fresh.stockReleasedAt) {
      for (const item of order.items) {
        if (!item.variantId) continue;
        await tx.variant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: `${args.by === "admin" ? "[admin] " : ""}${args.reason}`.slice(0, 1000),
        stockReleasedAt: fresh.stockReleasedAt ?? new Date(),
        paymentStatus: gatewayRefund ? PaymentStatus.REFUNDED : undefined,
      },
    });

    if (gatewayRefund && paidPayment) {
      await tx.refund.create({
        data: {
          orderId: order.id,
          status: RefundStatus.PENDING, // webhook flips to PROCESSED
          razorpayRefundId: gatewayRefund.refundId,
          razorpayPaymentId: paidPayment.razorpayPaymentId,
          amountPaise: order.totalPaise,
          reason: args.reason.slice(0, 1000),
          raw: gatewayRefund.raw as Prisma.InputJsonValue,
        },
      });
    }
  });

  await sendOrderCancelledEmail(
    {
      id: order.id,
      orderNumber: order.orderNumber,
      email: order.email,
      paymentMethod: order.paymentMethod,
      totalPaise: order.totalPaise,
      shipName: order.shipName,
      shipLine1: order.shipLine1,
      shipLine2: order.shipLine2,
      shipCity: order.shipCity,
      shipState: order.shipState,
      shipPincode: order.shipPincode,
      items: [],
    },
    { refundPaise },
  ).catch((err) => console.error("[orders] cancellation email failed:", err));

  return { alreadyCancelled: false, refundPaise };
}
