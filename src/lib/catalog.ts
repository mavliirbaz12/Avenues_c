import { Prisma, type Gender } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Read models for the storefront.
 *
 * Everything that renders a product — the landing strip, the shop grid,
 * search results, related products, the wishlist — goes through
 * `toProductCard` so pricing, stock and image fallback behave identically
 * everywhere. Add a badge in one place and it appears in all of them.
 */

export const productCardSelect = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  highlight: true,
  gender: true,
  concentration: true,
  longevity: true,
  avgRating: true,
  reviewCount: true,
  notesTop: true,
  notesHeart: true,
  notesBase: true,
  occasions: true,
  createdAt: true,
  variants: {
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { pricePaise: "asc" }] as const,
    select: {
      id: true,
      size: true,
      sku: true,
      mrpPaise: true,
      pricePaise: true,
      stock: true,
    },
  },
  images: {
    orderBy: [{ isPrimary: "desc" }, { position: "asc" }] as const,
    take: 2,
    select: { url: true, alt: true },
  },
} satisfies Prisma.ProductSelect;

type ProductCardRow = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  /** Name without the brand prefix, for tight layouts. */
  shortName: string;
  tagline: string;
  highlight: string;
  gender: Gender;
  concentration: string;
  longevity: string;
  avgRating: number;
  reviewCount: number;
  notes: { top: string[]; heart: string[]; base: string[] };
  /** The variant a card's price and Add-to-cart act on: cheapest in-stock,
   *  falling back to the cheapest overall so an out-of-stock card still
   *  shows a price instead of nothing. */
  defaultVariant: {
    id: string;
    size: string;
    sku: string;
    mrpPaise: number;
    pricePaise: number;
    stock: number;
  } | null;
  variantCount: number;
  /** True when any active variant has stock. */
  inStock: boolean;
  image: { url: string; alt: string } | null;
  hoverImage: { url: string; alt: string } | null;
};

export function toProductCard(row: ProductCardRow): ProductCard {
  const variants = row.variants;
  const inStockVariants = variants.filter((v) => v.stock > 0);
  const defaultVariant = inStockVariants[0] ?? variants[0] ?? null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.name.replace(/^Avenues\s+/i, ""),
    tagline: row.tagline,
    highlight: row.highlight,
    gender: row.gender,
    concentration: row.concentration,
    longevity: row.longevity,
    avgRating: row.avgRating,
    reviewCount: row.reviewCount,
    notes: { top: row.notesTop, heart: row.notesHeart, base: row.notesBase },
    defaultVariant,
    variantCount: variants.length,
    inStock: inStockVariants.length > 0,
    image: row.images[0] ?? null,
    hoverImage: row.images[1] ?? null,
  };
}

export async function getActiveProductCards(args?: {
  where?: Prisma.ProductWhereInput;
  orderBy?: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[];
  take?: number;
}) {
  const rows = await prisma.product.findMany({
    where: { isActive: true, ...args?.where },
    orderBy: args?.orderBy ?? [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: args?.take,
    select: productCardSelect,
  });
  return rows.map(toProductCard);
}

export async function getFeaturedProductCards(take = 5) {
  const featured = await getActiveProductCards({ where: { isFeatured: true }, take });
  if (featured.length > 0) return featured;
  // Nothing flagged featured in admin — fall back to the catalogue order so
  // the landing page never renders an empty strip.
  return getActiveProductCards({ take });
}

export async function getRelatedProductCards(product: {
  id: string;
  gender: Gender;
}, take = 4) {
  // Same gender first, then anything else, so a 5-SKU catalogue still fills
  // the row instead of showing one lonely card.
  const sameGender = await getActiveProductCards({
    where: { id: { not: product.id }, gender: product.gender },
    take,
  });
  if (sameGender.length >= take) return sameGender;

  const rest = await getActiveProductCards({
    where: {
      id: { not: product.id },
      NOT: { gender: product.gender },
    },
    take: take - sameGender.length,
  });
  return [...sameGender, ...rest];
}

/**
 * Site search.
 *
 * The catalogue is small enough (five SKUs, tens at most for years) that
 * scoring in memory beats a Postgres full-text index on both relevance and
 * complexity — it lets a search for "vanilla" match a base note, which
 * `contains` on a text column cannot do across array fields.
 *
 * If the catalogue ever passes a few hundred products, replace this with a
 * tsvector column and a GIN index; the call signature does not change.
 */
export async function searchProducts(query: string, take = 8) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const terms = q.split(/\s+/).filter(Boolean);
  const rows = await prisma.product.findMany({
    where: { isActive: true },
    select: productCardSelect,
  });

  const scored = rows
    .map((row) => {
      const name = row.name.toLowerCase();
      const notes = [...row.notesTop, ...row.notesHeart, ...row.notesBase].map((n) =>
        n.toLowerCase(),
      );
      const tagline = row.tagline.toLowerCase();
      const occasions = row.occasions.map((o) => o.toLowerCase());

      let score = 0;
      for (const term of terms) {
        if (name === term || name === `avenues ${term}`) score += 100;
        else if (name.includes(term)) score += 50;
        if (tagline.includes(term)) score += 12;
        if (notes.some((n) => n.includes(term))) score += 20;
        if (row.gender.toLowerCase().includes(term)) score += 8;
        if (occasions.some((o) => o.includes(term))) score += 6;
      }
      return { row, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, take);

  return scored.map((s) => toProductCard(s.row));
}
