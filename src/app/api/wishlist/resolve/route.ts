import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { productCardSelect, toProductCard } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const schema = z.object({ productIds: z.array(z.string().min(1)).max(200) });

/**
 * Turns a list of wishlist product ids into full product cards.
 *
 * Deliberately unauthenticated: a guest's wishlist exists only in their
 * browser, so the ids arrive from the client either way. Inactive products
 * simply drop out of the result — the wishlist page never shows a dead card.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  if (parsed.data.productIds.length === 0) {
    return NextResponse.json({ products: [] });
  }

  const rows = await prisma.product.findMany({
    where: { id: { in: parsed.data.productIds }, isActive: true },
    select: productCardSelect,
  });

  // Preserve the order the customer saved them in.
  const order = new Map(parsed.data.productIds.map((id, i) => [id, i]));
  const products = rows
    .map(toProductCard)
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return NextResponse.json({ products });
}
