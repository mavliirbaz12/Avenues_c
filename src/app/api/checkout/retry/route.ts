import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { retryPayment, OrderError } from "@/lib/commerce/orders";
import { verifyOrderAccessToken } from "@/lib/commerce/order-token";
import { limitByIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  orderId: z.string().min(1),
  // Guests authorise with the HMAC token from their success/email link.
  accessToken: z.string().optional().nullable(),
});

/** Re-opens payment for a PENDING prepaid order (failed or abandoned attempt). */
export async function POST(req: NextRequest) {
  const limit = await limitByIp("pay-retry", 10, 300_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    select: { id: true, userId: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  // Authorised if it's your order, or you hold the guest access token.
  const session = await auth().catch(() => null);
  const isOwner = Boolean(session?.user?.id && order.userId === session.user.id);
  const hasToken = verifyOrderAccessToken(order.id, parsed.data.accessToken);
  if (!isOwner && !hasToken) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  try {
    const result = await retryPayment(order.id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 409 });
    }
    console.error("[checkout] retry failed:", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
