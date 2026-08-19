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
  getCatalogueSummary,
  getComboCards,
  searchProducts,
  spellCount,
  type ProductCard as Card,
} from "@/lib/catalog";
import { siteUrl } from "@/lib/env";

export const metadata: Metadata = {
  title: "Shop all fragrances",
  description:
    "Every Avenues fragrance — eau de parfum, 50ml, eight to ten hours of wear. Filter by who it's for, size and price.",
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
  const [all, sets, summary] = await Promise.all([
    getActiveProductCards({ where: { type: "SINGLE" } }),
    // Gift sets, for the band BELOW the fragrance grid. They are fetched
    // separately and rendered separately on purpose: mixed into the grid a set
    // competes with the fragrances on price and reads as a sixth variant of
    // the same thing, and it made the filters lie (a set has no single gender
    // or size to facet on). Kept apart, the page answers "which fragrance"
    // first and "or give the whole house" second.
    getComboCards(),
    getCatalogueSummary().catch(() => ({ count: 0, sizeLabel: "", sizes: [] as string[] })),
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
    sizes: [...new Set(all.flatMap((p) => (p.defaultVariant ? [p.defaultVariant.size] : [])))]
      .sort()
      .map((size) => ({
        value: size,
        count: all.filter((p) => p.defaultVariant?.size === size).length,
      })),
    priceBuckets: BUCKETS.map((b) => ({
      value: b.value,
      label: b.label,
      count: all.filter((p) => p.defaultVariant && bucketFor(p.defaultVariant.pricePaise) === b.value)
        .length,
    })).filter((b) => b.count > 0),
  };

  let products = base.filter((p) => {
    // Defensive: a ?kind= in an old bookmark should not resurrect sets here.
    if (p.type !== "SINGLE") return false;
    if (kindFilter.size && !kindFilter.has(p.type)) return false;
    if (genderFilter.size && !genderFilter.has(p.gender)) return false;
    if (sizeFilter.size && !(p.defaultVariant && sizeFilter.has(p.defaultVariant.size))) return false;
    if (priceFilter.size) {
      const b = p.defaultVariant ? bucketFor(p.defaultVariant.pricePaise) : undefined;
      if (!b || !priceFilter.has(b)) return false;
    }
    return true;
  });

  // Search results arrive ranked by relevance; only re-sort on an explicit choice.
  if (sort === "price-asc") {
    products = [...products].sort(
      (a, b) => (a.defaultVariant?.pricePaise ?? 0) - (b.defaultVariant?.pricePaise ?? 0),
    );
  } else if (sort === "price-desc") {
    products = [...products].sort(
      (a, b) => (b.defaultVariant?.pricePaise ?? 0) - (a.defaultVariant?.pricePaise ?? 0),
    );
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
          {/* Counted, never asserted — this page now also lists gift sets, and
              a hardcoded "Five of them" was already one launch away from being
              wrong. See getCatalogueSummary. */}
          <p className="mx-auto mt-5 max-w-lg font-sans text-body-lg leading-relaxed text-stone">
            {summary.count > 0 ? `${spellCount(summary.count)} of them. ` : ""}All eau de
            parfum{summary.sizeLabel ? `, all ${summary.sizeLabel}` : ""}, all built to last
            a full day rather than a meeting.
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
