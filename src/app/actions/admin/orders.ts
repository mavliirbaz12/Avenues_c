"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { OrderStatus, ReturnStatus, PaymentStatus, RefundStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminActor } from "@/lib/admin-guard";
import { createOrderShipment, syncOrderTracking } from "@/lib/shipping/sync";
import { cancelOrder, CancelError } from "@/lib/commerce/cancellations";
import { refundPayment } from "@/lib/payments/razorpay";
import type { SimpleActionState } from "@/lib/form-state";

function revalidateOrder(orderId: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
}

/* -------------------------------------------------------------------------- */
/* Shipment                                                                    */
/* -------------------------------------------------------------------------- */

export async function adminCreateShipment(orderId: string): Promise<SimpleActionState> {
  await requireAdminActor();
  try {
    const shipment = await createOrderShipment(orderId);
    revalidateOrder(orderId);
    return { ok: true, message: `Shipment created — AWB ${shipment.waybill}.` };
  } catch (err) {
    console.error("[admin:orders] shipment failed:", err);
    return { ok: false, message: (err as Error).message || "Shipment creation failed." };
  }
}

export async function adminRefreshTracking(orderId: string): Promise<SimpleActionState> {
  await requireAdminActor();
  await syncOrderTracking(orderId, { force: true });
  revalidateOrder(orderId);
  return { ok: true, message: "Tracking refreshed." };
}

/* -------------------------------------------------------------------------- */
/* Manual status moves                                                         */
/* -------------------------------------------------------------------------- */

// Only the transitions that make operational sense by hand. Everything else
// happens through payments, shipments or the courier feed.
const MANUAL_MOVES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.CONFIRMED]: [OrderStatus.PACKED],
  [OrderStatus.PACKED]: [OrderStatus.SHIPPED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
  [OrderStatus.RTO]: [OrderStatus.RETURNED],
};

export async function adminSetStatus(
  orderId: string,
  to: OrderStatus,
): Promise<SimpleActionState> {
  await requireAdminActor();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, paymentMethod: true },
  });
  if (!order) return { ok: false, message: "Order not found." };

  const allowed = MANUAL_MOVES[order.status] ?? [];
  if (!allowed.includes(to)) {
    return { ok: false, message: `Can't move a ${order.status} order to ${to} by hand.` };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: to,
      deliveredAt: to === OrderStatus.DELIVERED ? new Date() : undefined,
      // A delivered COD order has been paid in cash.
      paymentStatus:
        to === OrderStatus.DELIVERED && order.paymentMethod === "COD"
          ? PaymentStatus.PAID
          : undefined,
    },
  });

  revalidateOrder(orderId);
  return { ok: true, message: `Marked ${to.toLowerCase().replace(/_/g, " ")}.` };
}

/* -------------------------------------------------------------------------- */
/* Cancel + refund                                                             */
/* -------------------------------------------------------------------------- */

const cancelSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(3, "Give a reason — it goes on the record.").max(500),
});

export async function adminCancelOrder(
  _prev: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  await requireAdminActor();

  const parsed = cancelSchema.safeParse({
    orderId: formData.get("orderId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  try {
    const result = await cancelOrder({
      orderId: parsed.data.orderId,
      reason: parsed.data.reason,
      by: "admin",
    });
    revalidateOrder(parsed.data.orderId);
    return {
      ok: true,
      message: result.refundPaise
        ? "Cancelled. Refund initiated with Razorpay."
        : "Cancelled. No payment to refund.",
    };
  } catch (err) {
    if (err instanceof CancelError) return { ok: false, message: err.message };
    console.error("[admin:orders] cancel failed:", err);
    return { ok: false, message: "Cancellation failed — check the logs." };
  }
}

/* -------------------------------------------------------------------------- */
/* Returns                                                                     */
/* -------------------------------------------------------------------------- */

const returnResolveSchema = z.object({
  orderId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED", "COMPLETED"]),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
  refund: z.enum(["yes", "no"]).default("no"),
});

/**
 * Resolves a return request.
 *  - APPROVED: customer sends it back; order stays RETURN_REQUESTED until
 *    COMPLETED.
 *  - COMPLETED: goods received — order becomes RETURNED, stock restored,
 *    optional Razorpay refund for prepaid orders.
 *  - REJECTED: order returns to DELIVERED with the note on record.
 */
export async function adminResolveReturn(
  _prev: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  await requireAdminActor();

  const parsed = returnResolveSchema.safeParse({
    orderId: formData.get("orderId"),
    decision: formData.get("decision"),
    note: formData.get("note") ?? "",
    refund: formData.get("refund") ?? "no",
  });
  if (!parsed.success) return { ok: false, message: "Check the form." };

  const { orderId, decision, note, refund } = parsed.data;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      returnRequest: true,
      items: { select: { variantId: true, quantity: true } },
      payments: { where: { status: PaymentStatus.PAID }, take: 1 },
    },
  });
  if (!order?.returnRequest) return { ok: false, message: "No return request on this order." };

  if (decision === "REJECTED") {
    await prisma.$transaction([
      prisma.returnRequest.update({
        where: { id: order.returnRequest.id },
        data: { status: ReturnStatus.REJECTED, adminNote: note || null, resolvedAt: new Date() },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.DELIVERED },
      }),
    ]);
    revalidateOrder(orderId);
    return { ok: true, message: "Return rejected; order back to delivered." };
  }

  if (decision === "APPROVED") {
    await prisma.returnRequest.update({
      where: { id: order.returnRequest.id },
      data: { status: ReturnStatus.APPROVED, adminNote: note || null },
    });
    revalidateOrder(orderId);
    return { ok: true, message: "Return approved — mark it completed once the parcel is back." };
  }

  // COMPLETED — goods received back.
  const paidPayment = order.payments[0];
  let refunded = false;

  if (refund === "yes" && paidPayment?.razorpayPaymentId) {
    const gateway = await refundPayment({
      razorpayPaymentId: paidPayment.razorpayPaymentId,
      amountPaise: order.totalPaise,
      notes: { orderNumber: order.orderNumber, reason: "Return completed" },
    });
    await prisma.refund.create({
      data: {
        orderId: order.id,
        status: RefundStatus.PENDING,
        razorpayRefundId: gateway.refundId,
        razorpayPaymentId: paidPayment.razorpayPaymentId,
        amountPaise: order.totalPaise,
        reason: "Return completed",
        raw: gateway.raw as Prisma.InputJsonValue,
      },
    });
    refunded = true;
  }

  await prisma.$transaction(async (tx) => {
    // Returned goods go back on the shelf.
    for (const item of order.items) {
      if (!item.variantId) continue;
      await tx.variant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    }
    await tx.returnRequest.update({
      where: { id: order.returnRequest!.id },
      data: { status: ReturnStatus.COMPLETED, adminNote: note || null, resolvedAt: new Date() },
    });
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.RETURNED,
        paymentStatus: refunded ? PaymentStatus.REFUNDED : undefined,
      },
    });
  });

  revalidateOrder(orderId);
  return {
    ok: true,
    message: refunded
      ? "Return completed — stock restored, refund initiated."
      : "Return completed — stock restored.",
  };
}

/* -------------------------------------------------------------------------- */
/* Notes                                                                       */
/* -------------------------------------------------------------------------- */

export async function adminSaveNote(
  _prev: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  await requireAdminActor();

  const orderId = String(formData.get("orderId") ?? "");
  const note = String(formData.get("note") ?? "").slice(0, 2000);
  if (!orderId) return { ok: false, message: "Order missing." };

  await prisma.order.update({
    where: { id: orderId },
    data: { adminNote: note || null },
  });

  revalidateOrder(orderId);
  return { ok: true, message: "Note saved." };
}
