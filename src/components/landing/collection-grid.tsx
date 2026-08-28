import { ProductCard } from "@/components/product/product-card";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import type { ProductCard as ProductCardData } from "@/lib/catalog";

/**
 * "Shop the Collection" — the page's conversion section, and the only place on
 * the landing page with price and Add to cart.
 *
 * The statutory "inclusive of all taxes" line sits ONCE beneath the grid
 * rather than on all five cards. Repeating it per card is clutter, and the
 * meaning is identical.
 */
export function CollectionGrid({ products }: { products: ProductCardData[] }) {
  if (products.length === 0) return null;

  return (
    <section id="collection" className="scroll-mt-[calc(var(--header-h)+2rem)] py-section" aria-labelledby="collection-heading">
      <div className="shell">
        <Reveal className="text-center">
          <p className="micro-label-gold">The collection</p>
          {/*
            The heading stays for screen readers and for the #collection anchor,
            and is hidden visually.

            Deleting it outright broke two things at once: the section carries
            `aria-labelledby="collection-heading"`, so with no such element it
            had NO accessible name at all, and the "skip to the collection"
            anchor had nothing to scroll to. The eyebrow above is a paragraph,
            not a heading, so it cannot stand in for either.
          */}
          <h2 id="collection-heading" className="sr-only">
            The collection
          </h2>
          {/*
            The visible heading and its paragraph are gone.

            They said "No filler" over "Each one built around a single idea, and
            finished only when it lasted a full day on skin" — a claim any
            perfume house could make about any product, sitting directly above
            the products themselves. The bottles, prices and notes below say
            more than the sentence did, and they say it about these fragrances
            specifically.
          */}
        </Reveal>

        {/*
          A RAIL, not a grid.

          Three cards in a three-column grid look like a row that ran out; the
          same three in a rail read as a range you are moving through, and the
          layout stops changing shape as the catalogue grows — a fourth product
          extends the rail instead of starting a lonely second row.

          `items-stretch` plus `h-full` on the card is what keeps them the same
          height when one tagline wraps and another does not. Card widths are
          fixed per breakpoint so every card is the same size at every width,
          which is the thing that makes a rail look deliberate rather than
          ragged.
        */}
        <RevealGroup
          className="no-scrollbar -mx-gutter mt-14 flex snap-x snap-mandatory items-stretch gap-5
                     overflow-x-auto px-gutter pb-2 sm:gap-6 lg:mt-16"
        >
          {products.map((p, i) => (
            <RevealItem
              key={p.id}
              className="w-[78vw] shrink-0 snap-center sm:w-[46vw] lg:w-[22rem]"
            >
              <div className="h-full">
                <ProductCard product={p} index={i + 1} priority={i < 3} showNotes />
              </div>
            </RevealItem>
          ))}
        </RevealGroup>

        <p className="mt-12 text-center font-sans text-xs text-stone-dark">
          All prices inclusive of all taxes. Free delivery over the threshold shown at checkout.
        </p>
      </div>
    </section>
  );
}
