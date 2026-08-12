import { NextResponse, type NextRequest } from "next/server";
import { searchProducts } from "@/lib/catalog";
import { limitByIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 80);

  if (q.trim().length < 2) {
    return NextResponse.json({ results: [], query: q });
  }

  const limit = await limitByIp("search", 40, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { results: [], query: q, error: "Slow down a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const cards = await searchProducts(q, 6);

  return NextResponse.json({
    query: q,
    results: cards.map((c) => ({
      slug: c.slug,
      name: c.name,
      shortName: c.shortName,
      tagline: c.tagline,
      gender: c.gender,
      pricePaise: c.defaultVariant?.pricePaise ?? null,
      mrpPaise: c.defaultVariant?.mrpPaise ?? null,
      size: c.defaultVariant?.size ?? null,
      inStock: c.inStock,
      imageUrl: c.image?.url ?? null,
    })),
  });
}
