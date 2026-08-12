import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PaymentMethod } from "@prisma/client";
import { priceCart, codAllowed } from "@/lib/commerce/pricing";
import { limitByIp } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  items: z
    .array(z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(20) }))
    .max(40),
  couponCode: z.string().trim().max(40).optional().nullable(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional().nullable(),
});

/**
 * Re-prices a cart from the database.
 *
 * The client never computes a total it can act on — it renders whatever this
 * returns. Rate limited because it is also the coupon validation endpoint and
 * would otherwise allow brute-forcing codes.
 */
export async function POST(req: NextRequest) {
  const limit = await limitByIp("cart-price", 60, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const session = await auth().catch(() => null);
  const userId = session?.user?.id ?? null;

  const priced = await priceCart(parsed.data.items, {
    couponCode: parsed.data.couponCode ?? null,
    paymentMethod: parsed.data.paymentMethod ?? null,
    userId,
  });

  // Deliberately does not serialise the whole settings object.
  return NextResponse.json({
    lines: priced.lines,
    dropped: priced.dropped,
    itemCount: priced.itemCount,
    subtotalPaise: priced.subtotalPaise,
    mrpTotalPaise: priced.mrpTotalPaise,
    discountPaise: priced.discountPaise,
    shippingPaise: priced.shippingPaise,
    codFeePaise: priced.codFeePaise,
    totalPaise: priced.totalPaise,
    coupon: priced.coupon,
    freeShippingThresholdPaise: priced.freeShippingThresholdPaise,
    toFreeShippingPaise: priced.toFreeShippingPaise,
    codEnabled: codAllowed(priced.settings, priced.totalPaise),
    codFeeIfChosenPaise: priced.settings.codFeePaise,
  });
}
