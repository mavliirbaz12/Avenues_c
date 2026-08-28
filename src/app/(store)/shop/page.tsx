import type { Metadata } from "next";
import Link from "next/link";
import { Gender } from "@prisma/client";
import { ProductCard } from "@/components/product/product-card";
import { FilterBar, type FacetData } from "@/components/shop/filter-bar";
import { GoldArc } from "@/components/brand/gold-arc";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { Sparkle } from "@/components/brand/sparkle";
import {
  getActiveProductCards,
  getComboCards,
  searchProducts,
  type ProductCard as Card,
} from "@/lib/catalog";
import { siteUrl } from "@/lib/env";

export const metadata: Metadata = {
  title: "Shop all fragrances",
  description:
    // No bottle size: the shop sells whatever sizes admin has created, and a
    // description naming one is wrong the moment a second exists.
    "Every Avenues fragrance — eau de parfum, eight to ten hours of wear. Filter by who it's for, size and price.",
  alternates: { canonical: `${siteUrl}/shop` },
};

export const revalidate = 3600;

const GENDER_LABEL: Record<Gender, string> = {
  MEN: "Him",
  WOMEN: "Her",
  UNISEX: "Anyone",
};

// Buckets are wide on purpose. They exist so the filter still makes sense
// once the catalogue spans several price points; today every fragrance sits
// in one bucket and the control hides itself (see FilterBar).
const BUCKETS: { value: string; min: number; max: number | null; label: string }[] = [
  { value: "under-1000", min: 0, max: 99999, label: "Under ₹1,000" },
  { value: "1000-2000", min: 100000, max: 200000, label: "₹1,000 – ₹2,000" },
  { value: "over-2000", min: 200001, max: null, label: "Above ₹2,000" },
];

function bucketFor(pricePaise: number) {
  return BUCKETS.find((b) => pricePaise >= b.min && (b.max === null || pricePaise <= b.max))?.value;
}

/**
 * Orders "50ml" before "100ml". A plain string sort puts 100ml first, because
 * "1" sorts before "5" — which is how the facet would list them the day a
 * second size is added.
 */
function sizeRank(size: string) {
  const n = Number.parseFloat(size.match(/[\d.]+/)?.[0] ?? "");
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

/** The ends of a product's price range, for the two sort directions. */
function cheapestPaise(p: Card) {
  return p.variants.length ? Math.min(...p.variants.map((v) => v.pricePaise)) : 0;
}
function dearestPaise(p: Card) {
  return p.variants.length ? Math.max(...p.variants.map((v) => v.pricePaise)) : 0;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const many = (k: string) => new Set(one(k).split(",").filter(Boolean));

  const q = one("q").trim();
  const kindFilter = many("kind");
  const genderFilter = many("gender");
  const sizeFilter = many("size");
  const priceFilter = many("price");
  const sort = one("sort") || "featured";

  // A search narrows the candidate set; otherwise start from the whole
  // catalogue. Facet counts below are always computed from the full set so
  // the numbers don't jump around as filters are applied.
  // Fragrances only. Gift sets live at /sets and in the nav — listing them
  // here too made the same product appear in two places with two different
  // framings, and made "5 fragrances" wrong. A set added from admin now shows
  // up on /sets and nowhere else.
  const [all, sets] = await Promise.all([
    getActiveProductCards({ where: { type: "SINGLE" } }),
    // Gift sets, for the band BELOW the fragrance grid. They are fetched
    // separately and rendered separately on purpose: mixed into the grid a set
    // competes with the fragrances on price and reads as a sixth variant of
    // the same thing, and it made the filters lie (a set has no single gender
    // or size to facet on). Kept apart, the page answers "which fragrance"
    // first and "or give the whole house" second.
    getComboCards(),
  ]);
  const base: Card[] = q ? await searchProducts(q, 50) : all;

  const facets: FacetData = {
    // Empty: this page lists fragrances only, so the facet has one option and
    // FilterBar hides it. Kept in the shape so the type stays honest.
    kinds: [],
    genders: (Object.keys(GENDER_LABEL) as Gender[])
      .map((g) => ({
        value: g,
        label: GENDER_LABEL[g],
        count: all.filter((p) => p.gender === g).length,
      }))
      .filter((g) => g.count > 0),
    // Both of these read EVERY size, not the default one. A fragrance sold in
    // 50ml and 100ml belongs under both size facets and in both price bands —
    // faceting on `defaultVariant` alone offered a "100ml" filter that matched
    // no products at all, and hid the product from the band its larger bottle
    // actually falls in.
    sizes: [...new Set(all.flatMap((p) => p.variants.map((v) => v.size)))]
      .sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b))
      .map((size) => ({
        value: size,
        count: all.filter((p) => p.variants.some((v) => v.size === size)).length,
      })),
    priceBuckets: BUCKETS.map((b) => ({
      value: b.value,
      label: b.label,
      count: all.filter((p) => p.variants.some((v) => bucketFor(v.pricePaise) === b.value)).length,
    })).filter((b) => b.count > 0),
  };

  let products = base.filter((p) => {
    // Defensive: a ?kind= in an old bookmark should not resurrect sets here.
    if (p.type !== "SINGLE") return false;
    if (kindFilter.size && !kindFilter.has(p.type)) return false;
    if (genderFilter.size && !genderFilter.has(p.gender)) return false;
    // Match on ANY size, mirroring how the facets are counted above.
    if (sizeFilter.size && !p.variants.some((v) => sizeFilter.has(v.size))) return false;
    if (
      priceFilter.size &&
      !p.variants.some((v) => {
        const b = bucketFor(v.pricePaise);
        return b !== undefined && priceFilter.has(b);
      })
    ) {
      return false;
    }
    return true;
  });

  // Search results arrive ranked by relevance; only re-sort on an explicit choice.
  //
  // Each direction sorts on the end of the range it is asking about: cheapest
  // first compares cheapest bottles, dearest first compares dearest ones.
  // Comparing both on `defaultVariant` would rank a fragrance whose 100ml is
  // the priciest in the shop below one that only sells a 50ml.
  if (sort === "price-asc") {
    products = [...products].sort((a, b) => cheapestPaise(a) - cheapestPaise(b));
  } else if (sort === "price-desc") {
    products = [...products].sort((a, b) => dearestPaise(b) - dearestPaise(a));
  }
  // "newest" and "featured" already come out of the query in the right order.

  const filtered =
    kindFilter.size || genderFilter.size || sizeFilter.size || priceFilter.size || q;

  return (
    <>
      <header className="shell pb-10 pt-14 text-center sm:pt-20">
        <Reveal>
          <p className="micro-label-gold">The range</p>
          <h1 className="mt-5 font-display text-d2 font-light text-bone">
            {q ? <>Results for &ldquo;{q}&rdquo;</> : "Every fragrance we make"}
          </h1>
          {/*
            Says nothing about how many or what size.

            This read the count and the sizes live, which kept it accurate and
            still produced "Nine of them. All eau de parfum, all 20ml & 50ml &
            100ml…" once admin had a few variants. The grid below answers "how
            many" better than a sentence can, and the filter bar answers "what
            sizes".
          */}
          <p className="mx-auto mt-5 max-w-lg font-sans text-body-lg leading-relaxed text-stone">
            Eau de parfum, built to last a full day rather than a meeting.
          </p>
        </Reveal>
        <GoldArc className="mt-10" />
      </header>

      <FilterBar facets={facets} total={all.length} matched={products.length} />

      {products.length === 0 ? (
        <EmptyShelf filtered={Boolean(filtered)} />
      ) : (
        <RevealGroup className="shell grid grid-cols-1 gap-x-6 gap-y-14 py-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-16">
          {products.map((p, i) => (
            <RevealItem key={p.id}>
              <ProductCard product={p} index={i + 1} priority={i < 3} />
            </RevealItem>
          ))}
        </RevealGroup>
      )}

      {/*
        Gift sets — a separate band, below the fragrances and clearly its own
        thing.

        Hidden while a search or a filter is active: those controls describe
        fragrances (gender, size, price bucket), so leaving an unfiltered set
        band under "no results for X" would look like the filter had failed.
      */}
      {sets.length > 0 && !filtered && (
        <section className="border-t border-line pt-14 pb-section" aria-labelledby="sets-heading">
          <div className="shell text-center">
            <Reveal>
              <p className="micro-label-gold">Boxed</p>
              <h2 id="sets-heading" className="mt-5 font-display text-d3 font-light text-bone">
                Or take the house
              </h2>
              <p className="mx-auto mt-5 max-w-lg font-sans text-body-lg leading-relaxed text-stone">
                Several fragrances in one box, priced below the sum of their
                parts — the honest way in, and the easiest thing to give.
              </p>
            </Reveal>
          </div>

          <RevealGroup className="shell mt-12 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-16">
            {sets.map((s, i) => (
              <RevealItem key={s.id}>
                <ProductCard product={s} index={i + 1} />
              </RevealItem>
            ))}
          </RevealGroup>

          <p className="shell mt-12 text-center font-sans text-xs text-stone-dark">
            Sets are already priced below the sum of their parts, so discount
            codes do not apply to them.
          </p>
        </section>
      )}
    </>
  );
}

function EmptyShelf({ filtered }: { filtered: boolean }) {
  return (
    <div className="shell py-24 text-center sm:py-32">
      <Sparkle className="mx-auto h-4 w-4 text-gold/50" />
      <h2 className="mt-6 font-display text-d4 font-light text-bone">
        {filtered ? "Nothing matches that combination" : "The shelf is being restocked"}
      </h2>
      <p className="mx-auto mt-4 max-w-md font-sans text-body-lg leading-relaxed text-stone">
        {filtered
          ? "The catalogue is deliberately small, so the filters run out of room quickly. Clear them and start again."
          : "Every fragrance is between batches right now. Leave your email in the footer and we will tell you the moment they are back."}
      </p>
      {filtered && (
        <Link href="/shop" className="btn btn-outline btn-md mt-9">
          Show all fragrances
        </Link>
      )}
    </div>
  );
}
