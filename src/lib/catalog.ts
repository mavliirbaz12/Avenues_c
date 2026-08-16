import { cache } from "react";
import { Prisma, type Gender, type ProductType } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Read models for the storefront.
 *
 * Everything that renders a product — the landing strip, the shop grid,
 * search results, related products, the wishlist — goes through
 * `toProductCard` so pricing, stock and image fallback behave identically
 * everywhere. Add a badge in one place and it appears in all of them.
 */

/**
 * The canonical URL for a product.
 *
 * Combos and fragrances share one slug namespace (Product.slug is unique), so
 * a collision is impossible — but they get different routes because the pages
 * answer different questions. A fragrance page is a note pyramid; a set page is
 * "what is in the box". One canonical URL each also keeps the sitemap honest.
 */
export function productHref(p: { slug: string; type: ProductType }) {
  return p.type === "COMBO" ? `/set/${p.slug}` : `/fragrance/${p.slug}`;
}

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
  type: true,
  savingsNote: true,
  // Cheap enough to always fetch: a card needs to say "4 fragrances" without a
  // second query, and it is zero rows for a SINGLE.
  _count: { select: { comboItems: true } },
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
  /** SINGLE fragrance or COMBO gift set. Decides the card's route and copy. */
  type: ProductType;
  /** COMBO only: how many fragrances are in the box. Never assume a number. */
  itemCount: number;
  /** COMBO only, optional: "Worth ₹2,499 bought separately". */
  savingsNote: string | null;
  /** The canonical route for this product — /fragrance/… or /set/…. */
  href: string;
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
    type: row.type,
    itemCount: row._count.comboItems,
    savingsNote: row.savingsNote,
    href: productHref(row),
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

/**
 * Slug + name for every active fragrance, for the nav dropdown and the footer
 * column. Both render on every storefront page and both used to issue this
 * query independently — identical text, twice per navigation. `cache()` makes
 * the second one free.
 *
 * Swallows errors like the callers did: a dead database should cost the site
 * its nav links, not the whole shell.
 */
export const getNavFragrances = cache(async () => {
  return prisma.product
    .findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
      orderBy: { sortOrder: "asc" },
      take: 8,
    })
    .catch(() => []);
});

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

// ---------------------------------------------------------------------------
// Combos / gift sets
// ---------------------------------------------------------------------------

/**
 * One fragrance inside a set, as the storefront renders it.
 *
 * Every scent detail here is read LIVE from the referenced product — nothing is
 * copied onto ComboItem. Editing a fragrance's tagline or reformulating its
 * notes updates every set containing it, with no admin having to remember which
 * boxes it is in.
 */
export type ComboMember = {
  id: string;
  sizeLabel: string;
  name: string;
  shortName: string;
  tagline: string;
  sensoryNarrative: string;
  bestFor: string;
  notes: { top: string[]; heart: string[]; base: string[] };
  image: { url: string; alt: string } | null;
  /**
   * Where to read more — null when the fragrance is no longer sold on its own.
   *
   * A deactivated member keeps its identity on the set page (a customer who
   * bought the box still needs to know what is in it) but loses the deep link,
   * because that page would 404.
   */
  href: string | null;
};

export const comboDetailSelect = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  highlight: true,
  description: true,
  type: true,
  savingsNote: true,
  couponEligible: true,
  countryOfOrigin: true,
  howToUse: true,
  caution: true,
  avgRating: true,
  reviewCount: true,
  metaTitle: true,
  metaDescription: true,
  variants: {
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }] as const,
    select: { id: true, size: true, sku: true, mrpPaise: true, pricePaise: true, stock: true },
  },
  images: {
    orderBy: [{ isPrimary: "desc" }, { position: "asc" }] as const,
    select: { url: true, alt: true },
  },
  comboItems: {
    orderBy: [{ position: "asc" }] as const,
    select: {
      id: true,
      sizeLabel: true,
      product: {
        select: {
          slug: true,
          name: true,
          tagline: true,
          sensoryNarrative: true,
          bestFor: true,
          notesTop: true,
          notesHeart: true,
          notesBase: true,
          isActive: true,
          type: true,
          images: {
            orderBy: [{ isPrimary: "desc" }, { position: "asc" }] as const,
            take: 1,
            select: { url: true, alt: true },
          },
        },
      },
    },
  },
} satisfies Prisma.ProductSelect;

type ComboRow = Prisma.ProductGetPayload<{ select: typeof comboDetailSelect }>;

export function toComboMembers(row: ComboRow): ComboMember[] {
  return row.comboItems.map((item) => ({
    id: item.id,
    sizeLabel: item.sizeLabel,
    name: item.product.name,
    shortName: item.product.name.replace(/^Avenues\s+/i, ""),
    tagline: item.product.tagline,
    sensoryNarrative: item.product.sensoryNarrative,
    bestFor: item.product.bestFor,
    notes: {
      top: item.product.notesTop,
      heart: item.product.notesHeart,
      base: item.product.notesBase,
    },
    image: item.product.images[0] ?? null,
    href: item.product.isActive ? productHref(item.product) : null,
  }));
}

/** A single combo by slug, with its contents. Null for a non-combo slug. */
export const getCombo = cache(async (slug: string) => {
  const row = await prisma.product.findFirst({
    where: { slug, type: "COMBO", isActive: true },
    select: comboDetailSelect,
  });
  if (!row) return null;
  return { ...row, members: toComboMembers(row) };
});

/** Every active set, newest-featured first, for /sets. */
export async function getComboCards(take?: number) {
  return getActiveProductCards({
    where: { type: "COMBO" },
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    take,
  });
}

/**
 * The set to feature on the landing page.
 *
 * Prefers an explicitly featured one so the founder controls it from admin;
 * falls back to any active set rather than leaving a hole in the page. Returns
 * null when there are no sets at all, and the band then renders nothing.
 */
export async function getFeaturedCombo(): Promise<ProductCard | null> {
  const featured = await getComboCards(1);
  return featured[0] ?? null;
}

/** Combos containing a given fragrance — used to guard deactivation. */
export async function combosContaining(productId: string) {
  const rows = await prisma.comboItem.findMany({
    where: { productId, combo: { isActive: true } },
    select: { combo: { select: { id: true, name: true, slug: true } } },
  });
  // The same fragrance can appear twice at different sizes.
  const seen = new Map<string, { id: string; name: string; slug: string }>();
  for (const r of rows) seen.set(r.combo.id, r.combo);
  return [...seen.values()];
}
