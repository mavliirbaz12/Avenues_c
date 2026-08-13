import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({ productId: z.string().min(1) });

/**
 * Mirrors the client wishlist to the database for signed-in users.
 *
 * Guests get a 401 and the WishlistButton silently swallows it — localStorage
 * is their source of truth until they sign in, at which point /api/sync merges
 * the local set upward. Both verbs are idempotent so double-taps and retries
 * are harmless.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const product = await prisma.product.findFirst({
    where: { id: parsed.data.productId, isActive: true },
    select: { id: true },
  });
  if (!product) return NextResponse.json({ error: "Unknown product." }, { status: 404 });

  await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId, productId: product.id } },
    update: {},
    create: { userId, productId: product.id },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  await prisma.wishlistItem.deleteMany({
    where: { userId, productId: parsed.data.productId },
  });

  return NextResponse.json({ ok: true });
}
