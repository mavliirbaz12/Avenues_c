import Link from "next/link";
import Image from "next/image";
import { BottleFigure } from "@/components/brand/bottle-figure";
import { Reveal } from "@/components/motion/reveal";
import { discountPercent } from "@/lib/format";
import type { ProductCard as ProductCardData } from "@/lib/catalog";
import { Price, DiscountChip } from "@/components/product/price";

/**
 * The gift-set band on the landing page.
 *
 * Driven by whichever set the admin flags as featured (`getFeaturedCombo`), so
 * swapping the hero set is a toggle, not a deploy. Renders nothing at all when
 * there is no active set — the page reads correctly without it rather than
 * showing an empty frame, which is what "hides gracefully" has to mean.
 *
 * The contents count comes from the data. Nothing here assumes four.
 */
export function ComboBand({ set }: { set: ProductCardData | null }) {
  if (!set) return null;

  const v = set.defaultVariant;
  const discounted = v ? v.mrpPaise > v.pricePaise : false;
  // One copy of this maths, shared with <Price> and the product card.
  const pct = v ? discountPercent(v.mrpPaise, v.pricePaise) : 0;

  return (
    <section
      id="sets"
      className="scroll-mt-[calc(var(--header-h)+2rem)] border-y border-line bg-surface/40 py-section"
      aria-labelledby="combo-band-heading"
      data-testid="combo-band"
    >
      <div className="shell grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <Link href={set.href} className="group block">
            <div className="relative aspect-[5/4] overflow-hidden border border-line bg-ink">
              {set.image ? (
                <Image
                  src={set.image.url}
                  alt={set.image.alt || set.name}
                  fill
                  sizes="(max-width: 1024px) 92vw, 45vw"
                  className="object-cover transition-transform duration-900 ease-smoke group-hover:scale-[1.02]"
                />
              ) : (
                <div
                  className="flex h-full items-center justify-center gap-2 p-10"
                  aria-hidden="true"
                >
                  {/* A row of bottles, one per fragrance in the box — capped at
                      five so a ten-piece set does not render a smear. */}
                  {set.itemCount > 0
                    ? Array.from({ length: Math.min(set.itemCount, 5) }, (_, i) => (
                        <BottleFigure
                          key={i}
                          slug={`${set.slug}-${i}`}
                          className="h-full max-h-[70%] w-auto"
                        />
                      ))
                    : <BottleFigure slug={set.slug} className="max-h-full" />}
                </div>
              )}

              {discounted && (
                <DiscountChip percent={pct} className="absolute right-4 top-4" />
              )}
            </div>
          </Link>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="micro-label-gold">
            {set.itemCount > 0
              ? `${set.itemCount} fragrance${set.itemCount === 1 ? "" : "s"}, one box`
              : "Boxed"}
          </p>

          <h2
            id="combo-band-heading"
            className="mt-5 max-w-md font-display text-d2 font-light text-bone"
          >
            {set.shortName}
          </h2>

          <p className="mt-6 max-w-md font-sans text-body-lg leading-relaxed text-stone">
            {set.highlight}
          </p>

          {/*
            The typed "Worth ₹X" note used to sit here and has been removed.

            It was a free-text field, so it kept its figure while the prices it
            described moved: the live site was still claiming "Worth ₹4,796"
            after single bottles dropped to ₹999, where the honest number was
            ₹3,996. Card surfaces already show the real saving as MRP struck
            through against the price, computed from the variant every time.

            The "worth as full bottles" line survives on the set's own page,
            where the members are loaded and it can be added up — see
            worthSeparatelyPaise.
          */}

          {v && (
            <Price pricePaise={v.pricePaise} mrpPaise={v.mrpPaise} badge={false} size="lg" className="mt-7" />
          )}

          <div className="mt-9 flex flex-wrap items-center gap-6">
            <Link href={set.href} className="btn btn-primary btn-lg">
              Explore the set
            </Link>
            <Link
              href="/sets"
              className="link-draw font-sans text-micro uppercase text-bone/90"
            >
              All gift sets
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
