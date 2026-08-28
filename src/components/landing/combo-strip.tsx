import Link from "next/link";
import Image from "next/image";
import { BottleFigure } from "@/components/brand/bottle-figure";
import { Reveal } from "@/components/motion/reveal";
import type { ProductCard as ProductCardData } from "@/lib/catalog";
import { Price } from "@/components/product/price";

/**
 * Every gift set, in a horizontal rail.
 *
 * The landing page previously showed exactly one set — whichever was featured —
 * in a full-width band. That was right when one set existed and stops being
 * right the moment a second does: a shop selling four boxes would advertise one
 * and leave the others to be discovered on /sets.
 *
 * The band still handles the single-set case, because a rail of one is a
 * design failure. This component takes over from two, mirroring how /sets picks
 * its layout. Nothing here assumes a count.
 *
 * Same rail mechanics as the reviews strip: overflow-x with snap on touch, grid
 * from `sm`. Cards carry their own contents count and size label, both read
 * from the data, so a 3, 5 or 6-piece set describes itself correctly without a
 * code change.
 */
export function ComboStrip({ sets }: { sets: ProductCardData[] }) {
  if (sets.length === 0) return null;

  return (
    <section
      id="sets"
      className="scroll-mt-[calc(var(--header-h)+2rem)] border-y border-line bg-surface/40 py-section"
      aria-labelledby="combo-strip-heading"
      data-testid="combo-strip"
    >
      <div className="shell text-center">
        <Reveal>
          <p className="micro-label-gold">Boxed</p>
          <h2
            id="combo-strip-heading"
            className="mt-5 font-display text-d3 font-light text-bone"
          >
            Try the house, or give it
          </h2>
        </Reveal>
      </div>

      <div
        className="no-scrollbar mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-gutter
                   sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3"
      >
        {sets.map((set, i) => {
          const v = set.defaultVariant;

          return (
            <Reveal
              key={set.id}
              delay={i * 0.05}
              className="w-[78vw] shrink-0 snap-center sm:w-auto"
            >
              <Link href={set.href} className="group block h-full">
                <div className="relative aspect-[5/4] overflow-hidden border border-line bg-ink">
                  {set.image ? (
                    <Image
                      src={set.image.url}
                      alt={set.image.alt || set.name}
                      fill
                      sizes="(max-width: 640px) 78vw, (max-width: 1024px) 45vw, 30vw"
                      className="object-cover transition-transform duration-900 ease-smoke group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div
                      className="flex h-full items-center justify-center gap-2 p-8"
                      aria-hidden="true"
                    >
                      {/* One bottle per fragrance, capped so a ten-piece set
                          does not render a smear. */}
                      {set.itemCount > 0 ? (
                        Array.from({ length: Math.min(set.itemCount, 5) }, (_, n) => (
                          <BottleFigure
                            key={n}
                            slug={`${set.slug}-${n}`}
                            className="h-full max-h-[70%] w-auto"
                          />
                        ))
                      ) : (
                        <BottleFigure slug={set.slug} className="max-h-full" />
                      )}
                    </div>
                  )}
                </div>

                <h3 className="mt-5 font-display text-d5 font-light text-bone transition-colors duration-300 group-hover:text-gold-light">
                  {set.shortName}
                </h3>

                {/*
                  Contents and size, both read from the data. A set of three or
                  six describes itself correctly with no code change, and the
                  size label comes from comboSizeLabel, which says "4 bottles"
                  rather than inventing a single size for a mixed box.
                */}
                <p className="mt-1.5 font-sans text-xs uppercase tracking-label text-stone-dark">
                  {set.itemCount > 0 && (
                    <>
                      {set.itemCount} fragrance{set.itemCount === 1 ? "" : "s"}
                      {v?.size ? " · " : ""}
                    </>
                  )}
                  {v?.size}
                </p>

                {v && (
                  <Price
                    pricePaise={v.pricePaise}
                    mrpPaise={v.mrpPaise}
                    size="md"
                    className="mt-3"
                  />
                )}
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
