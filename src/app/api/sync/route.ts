import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { CartLine } from "@/store/cart";

export const dynamic = "force-dynamic";

const schema = z.object({
  cart: z
    .array(z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(20) }))
    .max(40)
    .default([]),
  wishlist: z.array(z.string().min(1)).max(200).default([]),
});

/**
 * Merges a guest's local cart and wishlist into their account, then returns
 * the canonical server state for the client to adopt.
 *
 * Merge rule for quantities is MAX, not SUM. Summing looks reasonable until
 * you realise this runs on every page load after login — a cart with one
 * bottle would double on each navigation.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { cart: guestCart, wishlist: guestWishlist } = parsed.data;

  /* ---- Wishlist ---------------------------------------------------- */
  if (guestWishlist.length > 0) {
    const existing = await prisma.product.findMany({
      where: { id: { in: guestWishlist }, isActive: true },
      select: { id: true },
    });
    if (existing.length > 0) {
      await prisma.wishlistItem.createMany({
        data: existing.map((p) => ({ userId, productId: p.id })),
        skipDuplicates: true,
      });
    }
  }

  /* ---- Cart -------------------------------------------------------- */
  const dbCart = await prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: { id: true, items: { select: { variantId: true, quantity: true } } },
  });

  const merged = new Map<string, number>();
  for (const item of dbCart.items) merged.set(item.variantId, item.quantity);
  for (const item of guestCart) {
    merged.set(item.variantId, Math.max(merged.get(item.variantId) ?? 0, item.quantity));
  }

  // Drop anything that has since been deactivated or sold out.
  const variants = merged.size
    ? await prisma.variant.findMany({
        where: { id: { in: [...merged.keys()] }, isActive: true, product: { isActive: true } },
        select: {
          id: true,
          size: true,
          sku: true,
          mrpPaise: true,
          pricePaise: true,
          stock: true,
          product: {
            select: {
              id: true,
              slug: true,
              name: true,
              images: {
                orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      })
    : [];

  const lines: CartLine[] = [];
  for (const v of variants) {
    const wanted = merged.get(v.id) ?? 0;
    const quantity = Math.min(wanted, v.stock);
    if (quantity <= 0) continue;
    lines.push({
      variantId: v.id,
      productId: v.product.id,
      slug: v.product.slug,
      name: v.product.name,
      size: v.size,
      sku: v.sku,
      pricePaise: v.pricePaise,
      mrpPaise: v.mrpPaise,
      imageUrl: v.product.images[0]?.url ?? null,
      maxStock: v.stock,
      quantity,
    });
  }

  // Rewrite the persisted cart to exactly the merged result.
  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { cartId: dbCart.id } }),
    ...(lines.length
      ? [
          prisma.cartItem.createMany({
            data: lines.map((l) => ({
              cartId: dbCart.id,
              variantId: l.variantId,
              quantity: l.quantity,
            })),
          }),
        ]
      : []),
  ]);

  const wishlist = await prisma.wishlistItem.findMany({
    where: { userId },
    select: { productId: true },
  });

  return NextResponse.json({
    cart: lines,
    wishlist: wishlist.map((w) => w.productId),
  });
}
