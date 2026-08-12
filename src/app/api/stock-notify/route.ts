import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { limitByIp } from "@/lib/rate-limit";

const schema = z.object({
  variantId: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
});

export async function POST(req: NextRequest) {
  const limit = await limitByIp("stock-notify", 6, 300_000);
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

  const { variantId, email } = parsed.data;

  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    select: { id: true },
  });
  if (!variant) {
    return NextResponse.json({ error: "Unknown variant." }, { status: 404 });
  }

  try {
    await prisma.stockNotification.create({ data: { variantId, email } });
  } catch (err) {
    // Already registered for this variant — idempotent by design, so report
    // success rather than telling the caller who is on the list.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
      console.error("[stock-notify] failed:", err);
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
