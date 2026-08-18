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
export function CollectionGrid({
  products,
  countWord,
}: {
  products: ProductCardData[];
  /** Spelled-out live count, so the heading cannot go stale. */
  countWord: string;
}) {
  if (products.length === 0) return null;

  return (
    <section id="collection" className="scroll-mt-[calc(var(--header-h)+2rem)] py-section" aria-labelledby="collection-heading">
      <div className="shell">
        <Reveal className="text-center">
          <p className="micro-label-gold">The collection</p>
          <h2
            id="collection-heading"
            className="mx-auto mt-5 max-w-lg font-display text-d3 font-light text-bone"
          >
            {countWord} fragrances, and no filler
          </h2>
          <p className="mx-auto mt-5 max-w-md font-sans text-body-lg leading-relaxed text-stone">
            Each one built around a single idea, and finished only when it
            lasted a full day on skin.
          </p>
        </Reveal>

        <RevealGroup className="mt-14 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-16">
          {products.map((p, i) => (
            <RevealItem key={p.id}>
              <ProductCard product={p} index={i + 1} priority={i < 3} showNotes />
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
