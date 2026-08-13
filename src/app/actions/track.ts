"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { orderAccessToken } from "@/lib/commerce/order-token";
import { limitByIp } from "@/lib/rate-limit";
import { PHONE_REGEX } from "@/lib/constants/india";

export type TrackState = { ok: boolean; message: string };

export const TRACK_IDLE: TrackState = { ok: false, message: "" };

const schema = z.object({
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^AVN-[A-Z0-9]{6}$/, "That doesn't look like an Avenues order number."),
  contact: z.string().trim().min(3, "Enter the email or phone you ordered with."),
});

/**
 * Guest order lookup. Order number alone is not enough — it must be paired
 * with the checkout email or phone, and misses are answered with one generic
 * message so the form can't be used to probe which order numbers exist.
 */
export async function trackOrder(_prev: TrackState, formData: FormData): Promise<TrackState> {
  const limit = await limitByIp("track", 10, 300_000);
  if (!limit.ok) {
    return { ok: false, message: `Too many attempts. Try again in ${limit.retryAfter}s.` };
  }

  const parsed = schema.safeParse({
    orderNumber: formData.get("orderNumber"),
    contact: formData.get("contact"),
  });

  const MISS: TrackState = {
    ok: false,
    message: "We couldn't find an order matching those details. Check both and try again.",
  };

  if (!parsed.success) {
    // A malformed order number gets its specific hint; a short contact gets
    // the generic miss.
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message ?? MISS.message };
  }

  const { orderNumber, contact } = parsed.data;
  const contactLower = contact.toLowerCase();
  // Phones match on the last 10 digits so "+91 98765 43210" finds "9876543210".
  const digits = contact.replace(/\D/g, "").slice(-10);

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: { id: true, orderNumber: true, email: true, phone: true },
  });

  if (!order) return MISS;

  const emailMatch = order.email.toLowerCase() === contactLower;
  const phoneMatch =
    PHONE_REGEX.test(contact) && digits.length === 10 && order.phone.replace(/\D/g, "").endsWith(digits);

  if (!emailMatch && !phoneMatch) return MISS;

  redirect(`/order/${order.orderNumber}?t=${orderAccessToken(order.id)}`);
}
