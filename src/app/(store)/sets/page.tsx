import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getComboCards } from "@/lib/catalog";
import { siteUrl } from "@/lib/env";
import { formatPaise } from "@/lib/format";
import { ProductCard } from "@/components/product/product-card";
import { AddToCartButton } from "@/components/product/add-to-cart-button";
import { BottleFigure } from "@/components/brand/bottle-figure";
import { GoldArc } from "@/components/brand/gold-arc";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import type { ProductCard as ProductCardData } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Gift sets — try the house, or give it",
  description:
    "Avenues gift sets: several fragrances boxed together, priced below the sum of their parts. Try before committing to a full bottle.",
  alternates: { canonical: `${siteUrl}/sets` },
};

export const dynamic = "force-dynamic";

/**
 * The sets landing page.
 *
 * Layout switches on how many sets exist, because a grid of one is a design
 * failure and a hero of six is a scroll. One set gets a full-width feature;
 * two or more get the standard grid. Neither branch hardcodes how many
 * fragrances are inside any given set.
 */
export default async function SetsPage() {
  const sets = await getComboCards();

  return (
    <>
      <section className="shell py-section text-center">
        <Reveal>
          <p className="micro-label-gold">Boxed</p>
          <h1 className="mx-auto mt-5 max-w-2xl font-display text-d2 font-light text-bone">
            Try the house, or give it
          </h1>
          <p className="mx-auto mt-6 max-w-lg font-sans text-body-lg leading-relaxed text-stone">
            A fragrance reads differently on every person, and no description
            substitutes for wearing one for a day. A set is the honest way in —
            several to live with before you commit to a full bottle, and the
            easiest thing to hand someone who has not chosen for themselves yet.
          </p>
          <GoldArc className="mt-12" />
        </Reveal>
      </section>

      {sets.length === 0 ? (
        <EmptyShelf />
      ) : sets.length === 1 ? (
        <FeatureOne set={sets[0]!} />
      ) : (
        <section className="shell pb-section" aria-label="Gift sets">
          <RevealGroup className="grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-16">
            {sets.map((s, i) => (
              <RevealItem key={s.id}>
                <ProductCard product={s} index={i + 1} priority={i < 3} />
              </RevealItem>
            ))}
          </RevealGroup>

          <p className="mt-12 text-center font-sans text-xs text-stone-dark">
            All prices inclusive of all taxes. Sets are already priced below the
            sum of their parts, so discount codes do not apply to them.
          </p>
        </section>
      )}
    </>
  );
}

/**
 * The single-set layout: a full-width feature rather than one lonely card in a
 * three-column grid.
 */
function FeatureOne({ set }: { set: ProductCardData }) {
  const v = set.defaultVariant;
  const discounted = v ? v.mrpPaise > v.pricePaise : false;
  const pct =
    v && discounted ? Math.round(((v.mrpPaise - v.pricePaise) / v.mrpPaise) * 100) : 0;

  return (
    <section className="pb-section" aria-label={set.name}>
      <div className="shell grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <Link href={set.href} className="group block">
            <div className="relative aspect-[4/5] overflow-hidden border border-line bg-surface">
              {set.image ? (
                <Image
                  src={set.image.url}
                  alt={set.image.alt || set.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 92vw, 45vw"
                  className="object-cover transition-transform duration-900 ease-smoke group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-12">
                  <BottleFigure slug={set.slug} className="max-h-full" />
                </div>
              )}
              {discounted && (
                <span className="absolute right-4 top-4 bg-bordeaux px-3 py-1.5 font-sans text-[0.625rem] uppercase tracking-label text-bone">
                  {pct}% off
                </span>
              )}
            </div>
          </Link>
        </Reveal>

        <Reveal delay={0.1}>
          {/* Contents count from live data — never a literal. Rendered as one
              string so it stays a single text node: interpolating around the
              number makes React split it with comment markers, which is
              awkward to assert on and to read out. */}
          <p className="micro-label-gold" data-testid="set-item-count">
            {`${set.itemCount} fragrance${set.itemCount === 1 ? "" : "s"}`}
          </p>

          <h2 className="mt-5 font-display text-d2 font-light text-bone">
            <Link href={set.href} className="transition-colors hover:text-gold-light">
              {set.shortName}
            </Link>
          </h2>

          <p className="mt-4 font-sans text-micro uppercase tracking-micro text-gold">
            {set.tagline}
          </p>

          <p className="mt-6 max-w-md font-sans text-body-lg leading-relaxed text-stone">
            {set.highlight}
          </p>

          {set.savingsNote && (
            <p className="mt-6 inline-flex border border-gold/35 px-4 py-2 font-sans text-xs text-gold-light">
              {set.savingsNote}
            </p>
          )}

          {v && (
            <div className="mt-8 flex flex-wrap items-baseline gap-3">
              <span className="font-display text-4xl font-light text-bone">
                {formatPaise(v.pricePaise)}
              </span>
              {discounted && (
                <span className="font-sans text-lg text-stone-dark line-through">
                  {formatPaise(v.mrpPaise)}
                </span>
              )}
            </div>
          )}

          <div className="mt-9 flex flex-wrap items-center gap-4">
            {v && (
              <AddToCartButton
                line={{
                  variantId: v.id,
                  productId: set.id,
                  slug: set.slug,
                  name: set.name,
                  size: v.size,
                  sku: v.sku,
                  pricePaise: v.pricePaise,
                  mrpPaise: v.mrpPaise,
                  imageUrl: set.image?.url ?? null,
                  type: set.type,
                  maxStock: v.stock,
                }}
                disabled={v.stock <= 0}
                className="btn btn-primary btn-lg"
              >
                {v.stock > 0 ? "Add to cart" : "Sold out"}
              </AddToCartButton>
            )}
            <Link href={set.href} className="btn btn-outline btn-lg">
              What&rsquo;s inside
            </Link>
          </div>

          <p className="mt-6 font-sans text-xs text-stone-dark">
            Inclusive of all taxes. Discount codes do not apply to sets.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function EmptyShelf() {
  return (
    <section className="shell pb-section text-center">
      <p className="mx-auto max-w-md font-display text-d4 font-light text-bone">
        No sets are boxed right now
      </p>
      <p className="mx-auto mt-4 max-w-md font-sans text-body-lg leading-relaxed text-stone">
        They come and go with the seasons. In the meantime, every fragrance is
        available on its own.
      </p>
      <Link href="/shop" className="btn btn-outline btn-lg mt-9">
        Shop the fragrances
      </Link>
    </section>
  );
}
