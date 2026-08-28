import { cache } from "react";
import { cachedCatalog } from "./cache";
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

export type CardVariant = {
  id: string;
  size: string;
  sku: string;
  mrpPaise: number;
  pricePaise: number;
  stock: number;
};

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
  defaultVariant: CardVariant | null;
  /**
   * Every active size, cheapest first.
   *
   * The shop's size and price facets are built from this, not from
   * `defaultVariant`. Reading only the default meant a product's second size
   * was invisible to the filters: adding a 100ml beside a 50ml produced a
   * "100ml" facet that matched nothing, because the default stayed 50ml.
   */
  variants: CardVariant[];
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
    variants,
    variantCount: variants.length,
    inStock: inStockVariants.length > 0,
    image: row.images[0] ?? null,
    hoverImage: row.images[1] ?? null,
  };
}

/**
 * Every active product for the nav dropdown, the mobile drawer and the footer
 * column. All three render on every storefront page and each used to issue this
 * query independently — identical text, three times per navigation. `cache()`
 * makes the extra reads free.
 *
 * `type` and `href` are part of the row, and that is the whole point.
 *
 * This used to return `{ slug, name }` only, and all three consumers built
 * `/fragrance/${slug}` by hand. But the query has never filtered by type, so a
 * gift set came back in the list and got a fragrance URL — and Product.slug is
 * shared across both kinds, so nothing downstream could tell. The Discovery Set
 * sat in the Fragrances menu pointing at /fragrance/discovery-set, which the
 * fragrance page refuses to serve (it filters `type: "SINGLE"`). Visitors got a
 * dead link out of the primary nav.
 *
 * Returning the canonical href from `productHref` — the helper that already
 * exists for exactly this — makes the bug unrepresentable rather than merely
 * fixed: a caller cannot construct the wrong path from this data any more.
 *
 * Swallows errors like the callers did: a dead database should cost the site
 * its nav links, not the whole shell.
 */
const navFragrancesUncached = async () =>
  prisma.product
    .findMany({
      where: { isActive: true },
      select: { slug: true, name: true, type: true },
      orderBy: { sortOrder: "asc" },
      take: 8,
    })
    .then((rows) => rows.map((row) => ({ ...row, href: productHref(row) })))
    .catch(() => []);

/**
 * Two layers, and they do different jobs.
 *
 * `cachedCatalog` keeps the result between NAVIGATIONS, which is the one that
 * matters here: this runs in the storefront layout, so before it was cached
 * every page on the site paid for it — including pages with no data of their
 * own.
 *
 * `cache()` still wraps it because the nav and the footer both call this inside
 * a single render. Without it that would be two reads of the cache entry per
 * page rather than one.
 */
export const getNavFragrances = cache(
  cachedCatalog(navFragrancesUncached, ["nav-fragrances"]),
);

/**
 * One row of the nav/footer product list.
 *
 * Declared here rather than re-typed in each consumer, which is how the three
 * of them drifted into building their own URLs in the first place.
 */
export type NavProduct = {
  slug: string;
  name: string;
  type: ProductType;
  /** Canonical route — /fragrance/… or /set/…. Never rebuild this by hand. */
  href: string;
};

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

/**
 * Featured FRAGRANCES for the landing slider and collection grid.
 *
 * Explicitly excludes combos: a set is featured through its own band, and a
 * gift box sitting inside "Five fragrances, and no filler" makes both the
 * heading and the count wrong.
 */
export async function getFeaturedProductCards(take = 5) {
  const featured = await getActiveProductCards({
    where: { isFeatured: true, type: "SINGLE" },
    take,
  });
  if (featured.length > 0) return featured;
  // Nothing flagged featured in admin — fall back to the catalogue order so
  // the landing page never renders an empty strip.
  return getActiveProductCards({ where: { type: "SINGLE" }, take });
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
   * This fragrance's own full-bottle MRP, for the computed "worth separately"
   * line. Null when it has no active variant to price.
   */
  bottleMrpPaise: number | null;
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
          /*
            The member's own FULL BOTTLE price, for the "worth if bought
            separately" line. Cheapest active variant, matching how every other
            surface picks a product's headline price.

            Deliberately not the variant matching the member's sizeLabel: a set
            of 10ml decants has no 10ml SKU to price, and the claim being made
            is explicitly about buying the full bottles instead.
          */
          variants: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { pricePaise: "asc" }] as const,
            take: 1,
            select: { mrpPaise: true, pricePaise: true },
          },
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
    /** Full-bottle MRP of this fragrance, or null if it has no active variant. */
    bottleMrpPaise: item.product.variants[0]?.mrpPaise ?? null,
  }));
}

/**
 * What the contents would cost as full bottles, at today's prices.
 *
 * This replaces `savingsNote`, a free-text field an admin typed once. The
 * seeded value read "Worth ₹4,796 if bought as full bottles" — correct when
 * singles were ₹1,199, and still on the live site after they moved to ₹999,
 * by which point the true figure was ₹3,996. An inflated savings claim is a
 * worse thing to ship than no claim, and it cannot be kept honest by hand
 * because it depends on prices that change independently of the set.
 *
 * Returns null when any member has no active variant to price, so the caller
 * renders nothing rather than a total that silently omits a fragrance.
 */
export function worthSeparatelyPaise(members: { bottleMrpPaise: number | null }[]) {
  if (members.length === 0) return null;
  if (members.some((m) => m.bottleMrpPaise === null)) return null;
  return members.reduce((sum, m) => sum + (m.bottleMrpPaise ?? 0), 0);
}

/**
 * The size label for a set's own variant — "4 x 10ml", or "4 bottles" when the
 * contents are not all one size.
 *
 * The admin action built this as `${items.length} x ${items[0].sizeLabel}`,
 * reading the FIRST item and applying it to all of them. A set of three 10ml
 * and one 20ml therefore described itself as "4 x 10ml". Nothing breaks and
 * nobody notices until a customer counts what arrives.
 */
export function comboSizeLabel(sizes: string[]) {
  const distinct = [...new Set(sizes.map((s) => s.trim()).filter(Boolean))];
  if (distinct.length === 1) return `${sizes.length} x ${distinct[0]}`;
  return `${sizes.length} bottles`;
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

/**
 * How many fragrances there are, and in which sizes.
 *
 * The landing copy used to say "Five fragrances" and "50ml" as literals, in
 * nine places. That is true today and becomes a lie the first time an admin
 * adds a sixth scent or a 100ml bottle — and nothing would fail, the site
 * would simply state something false. Everything user-facing now reads from
 * here.
 *
 * Sets are excluded: a gift box is not a fragrance, and counting it would make
 * "Five fragrances, and no filler" wrong in the other direction.
 */
export const getCatalogueSummary = cache(async () => {
  const rows = await prisma.product
    .findMany({
      where: { isActive: true, type: "SINGLE" },
      select: { variants: { where: { isActive: true }, select: { size: true } } },
    })
    .catch(() => []);

  const sizes = [...new Set(rows.flatMap((r) => r.variants.map((v) => v.size)))].sort(
    // "50ml" before "100ml": numeric where possible, alphabetic otherwise.
    (a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0) || a.localeCompare(b),
  );

  return {
    count: rows.length,
    /** "50ml", or "50ml & 100ml", or "" when nothing is stocked. */
    sizeLabel: sizes.length === 0 ? "" : sizes.length === 1 ? sizes[0]! : sizes.join(" & "),
    sizes,
  };
});

/** 5 -> "Five". Falls back to digits past ten, where words stop helping. */
export function spellCount(n: number) {
  const words = ["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten"];
  return words[n] ?? String(n);
}

/**
 * Approved reviews across the whole catalogue, for the landing page strip.
 *
 * Product pages already query their own reviews; this is the store-wide view,
 * which nothing had. Reviewer names come from the User relation rather than
 * being stored on the review, so a rename is reflected everywhere at once.
 *
 * Only APPROVED rows leave the database. Moderation state is not something the
 * landing page should be filtering client-side.
 */
const homeReviewsUncached = async () =>
  prisma.review
    .findMany({
      where: { status: "APPROVED" },
      orderBy: [{ isVerifiedBuyer: "desc" }, { createdAt: "desc" }],
      take: 12,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        isVerifiedBuyer: true,
        user: { select: { name: true } },
        product: { select: { name: true, slug: true, type: true } },
      },
    })
    .catch(() => []);

export const getHomeReviews = cache(cachedCatalog(homeReviewsUncached, ["home-reviews"]));

export type HomeReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  isVerifiedBuyer: boolean;
  user: { name: string | null } | null;
  product: { name: string; slug: string; type: ProductType };
};
