"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { OrderStatus, ReturnStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { verifyOrderAccessToken } from "@/lib/commerce/order-token";
import { cancelOrder, CancelError } from "@/lib/commerce/cancellations";
import { limitByIp } from "@/lib/rate-limit";
import { sendEmail, emailShell, escapeHtml } from "@/lib/email";
import { getStoreSettings } from "@/lib/settings";
import { env, siteUrl } from "@/lib/env";

export type OrderActionState = { ok: boolean; message: string };

export const ORDER_ACTION_IDLE: OrderActionState = { ok: false, message: "" };

/** Owner-or-token authorisation, shared by both customer order actions. */
async function authoriseOrderAccess(orderId: string, accessToken: string | null) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true },
  });
  if (!order) return null;

  const session = await auth().catch(() => null);
  const isOwner = Boolean(session?.user?.id && order.userId === session.user.id);
  if (isOwner || verifyOrderAccessToken(order.id, accessToken)) return order.id;
  return null;
}

/* -------------------------------------------------------------------------- */
/* Customer cancellation (before shipment)                                     */
/* -------------------------------------------------------------------------- */

const cancelSchema = z.object({
  orderId: z.string().min(1),
  accessToken: z.string().optional().nullable(),
  reason: z.string().trim().min(3, "Tell us why, briefly.").max(500),
});

export async function customerCancelOrder(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const limit = await limitByIp("cancel", 6, 600_000);
  if (!limit.ok) {
    return { ok: false, message: `Too many attempts. Try again in ${limit.retryAfter}s.` };
  }

  const parsed = cancelSchema.safeParse({
    orderId: formData.get("orderId"),
    accessToken: formData.get("accessToken"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const orderId = await authoriseOrderAccess(parsed.data.orderId, parsed.data.accessToken ?? null);
  if (!orderId) return { ok: false, message: "You don't have access to this order." };

  try {
    const result = await cancelOrder({ orderId, reason: parsed.data.reason, by: "customer" });
    revalidatePath("/account/orders");
    return {
      ok: true,
      message: result.refundPaise
        ? "Order cancelled. Your refund is on its way — banks typically post it within 5 to 7 working days."
        : "Order cancelled. Nothing was charged.",
    };
  } catch (err) {
    if (err instanceof CancelError) return { ok: false, message: err.message };
    console.error("[orders] customer cancel failed:", err);
    return { ok: false, message: "Something went wrong. Try again, or write to us." };
  }
}

/* -------------------------------------------------------------------------- */
/* Return request (after delivery)                                             */
/* -------------------------------------------------------------------------- */

const returnSchema = z.object({
  orderId: z.string().min(1),
  accessToken: z.string().optional().nullable(),
  reason: z.string().trim().min(10, "A little more detail helps us fix it.").max(2000),
});

export async function requestReturn(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const limit = await limitByIp("return", 4, 600_000);
  if (!limit.ok) {
    return { ok: false, message: `Too many attempts. Try again in ${limit.retryAfter}s.` };
  }

  const parsed = returnSchema.safeParse({
    orderId: formData.get("orderId"),
    accessToken: formData.get("accessToken"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const orderId = await authoriseOrderAccess(parsed.data.orderId, parsed.data.accessToken ?? null);
  if (!orderId) return { ok: false, message: "You don't have access to this order." };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      email: true,
      deliveredAt: true,
      returnRequest: { select: { id: true } },
    },
  });
  if (!order) return { ok: false, message: "Order not found." };

  if (order.status !== OrderStatus.DELIVERED) {
    return {
      ok: false,
      message:
        order.status === OrderStatus.RETURN_REQUESTED
          ? "A return is already being processed for this order."
          : "Returns open once the order is delivered. If it hasn't arrived, message us instead.",
    };
  }
  if (order.returnRequest) {
    return { ok: false, message: "A return is already being processed for this order." };
  }

  await prisma.$transaction([
    prisma.returnRequest.create({
      data: { orderId: order.id, status: ReturnStatus.REQUESTED, reason: parsed.data.reason },
    }),
    prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.RETURN_REQUESTED },
    }),
  ]);

  const settings = await getStoreSettings();
  await sendEmail({
    to: env.EMAIL_ADMIN || settings.supportEmail,
    replyTo: order.email,
    subject: `Return requested — ${order.orderNumber}`,
    html: emailShell({
      preheader: `Return request on ${order.orderNumber}`,
      heading: "Return requested",
      body: `
        <p>Order <strong style="color:#F2EDE3;">${order.orderNumber}</strong>
        (${escapeHtml(order.email)}) has a return request.</p>
        <p style="white-space:pre-wrap;border-left:2px solid #232327;padding-left:14px;">${escapeHtml(parsed.data.reason)}</p>`,
      cta: { label: "Review in admin", href: `${siteUrl}/admin/orders` },
    }),
  }).catch(() => {});

  revalidatePath("/account/orders");
  return {
    ok: true,
    message: "Return request received. We'll reply within 24 hours with next steps.",
  };
}
