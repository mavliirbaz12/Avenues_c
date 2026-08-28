"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Reveal } from "@/components/motion/reveal";
import { GoldArc } from "@/components/brand/gold-arc";
import { cn } from "@/lib/utils";
import type { ProductCard } from "@/lib/catalog";

/**
 * "How a fragrance is built" — the note pyramid, explained, followed by an
 * index of the five mapped by their notes.
 *
 * Two things worth knowing:
 *
 * 1. The tier examples are aggregated from the REAL note arrays on the live
 *    products. This section used to illustrate itself with hand-written
 *    example notes while the actual data sat unused two files away.
 *
 * 2. The index below is deliberately TYPOGRAPHIC — no bottles. It is the
 *    third time the range appears on this page (after the slider and before
 *    the grid), and a third row of product imagery would read as padding.
 *    Setting it as type is also the most Le Labo thing here: their whole
 *    identity is typography instead of product photography.
 */

/**
 * Three rows, and the notes are the content.
 *
 * Each tier used to carry a ~150-character passage explaining what top, heart
 * and base notes are — "The lightest molecules, and the first thing anyone
 * smells…". All of it was true, none of it was ours: the same paragraph sits on
 * every perfume site on the internet, which is precisely why it read as
 * machine-written. It also pushed the one genuinely specific thing on the row —
 * the real notes, aggregated live from the products — down into small grey text
 * underneath.
 *
 * So the explanation is gone and the notes are the row. What is left of the
 * teaching is the timing, which is the part a customer cannot look up on the
 * bottle and the part that actually answers "why does it smell different now".
 */
const TIERS = [
  { key: "top", label: "Top", when: "First 15 minutes", width: "56%" },
  { key: "heart", label: "Heart", when: "One to three hours", width: "78%" },
  { key: "base", label: "Base", when: "Three to ten hours", width: "100%" },
] as const;

/** Distinct notes across the live catalogue, for a tier's example line. */
function aggregate(products: ProductCard[], tier: "top" | "heart" | "base", max = 5) {
  const seen = new Set<string>();
  for (const p of products) {
    for (const note of p.notes[tier]) {
      if (seen.size >= max) break;
      seen.add(note);
    }
  }
  return [...seen].join(" · ");
}

export function NotesStory({ products }: { products: ProductCard[] }) {
  const reduce = useReducedMotion();

  return (
    <section id="notes" className="relative scroll-mt-[calc(var(--header-h)+2rem)] py-section" aria-labelledby="notes-heading">
      <div className="shell">
        <Reveal className="text-center">
          <p className="micro-label-gold">The pyramid</p>
          <h2
            id="notes-heading"
            className="mx-auto mt-5 max-w-2xl font-display text-d3 font-light text-bone"
          >
            A fragrance is three things, arriving in order
          </h2>
          <p className="mx-auto mt-5 max-w-xl font-sans text-body-lg leading-relaxed text-stone">
            What you smell in the shop is not what you wear at dinner.
          </p>
        </Reveal>

        <div className="mx-auto mt-16 max-w-4xl space-y-5 lg:mt-20">
          {TIERS.map((tier, i) => {
            const examples = aggregate(products, tier.key);
            return (
              <motion.div
                key={tier.key}
                className="mx-auto"
                style={{ maxWidth: tier.width }}
                initial={reduce ? undefined : { opacity: 0, scaleX: 0.86, y: 18 }}
                whileInView={reduce ? undefined : { opacity: 1, scaleX: 1, y: 0 }}
                viewport={{ once: true, margin: "-15%" }}
                transition={{ duration: 1, delay: i * 0.14, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="group relative overflow-hidden border border-line bg-surface/70 p-7 transition-colors duration-600 ease-smoke hover:border-gold/35 sm:p-9">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-900 ease-smoke group-hover:opacity-100"
                    style={{
                      background: `radial-gradient(30rem 14rem at 50% 120%, rgba(201,162,75,${0.05 + i * 0.035}), transparent 70%)`,
                    }}
                  />

                  <div className="relative flex flex-wrap items-baseline justify-between gap-3">
                    <p className="micro-label-gold">{tier.label} notes</p>
                    <p className="micro-label">{tier.when}</p>
                  </div>

                  {/* The notes ARE the row now — display type, not a footnote. */}
                  {examples && (
                    <p className="relative mt-4 font-display text-d5 font-light leading-snug text-bone">
                      {examples}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* The five, by note — type only, no imagery. */}
        {products.length > 0 && (
          <div className="mx-auto mt-20 max-w-3xl">
            <Reveal className="text-center">
              <p className="micro-label">Recognise them by their base</p>
            </Reveal>

            <ul className="mt-8 border-t border-line">
              {products.map((p, i) => (
                // Reveal goes INSIDE the <li>, not around it. Wrapping the
                // item put a <div> between <ul> and <li>, which breaks the
                // list semantics — a screen reader stops announcing "list,
                // 5 items" and the rows become five orphaned elements.
                <li key={p.id} className="border-b border-line">
                  <Reveal delay={i * 0.05}>
                    <Link
                      href={`/fragrance/${p.slug}`}
                      className={cn(
                        "group flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 py-6",
                        "transition-colors duration-400 ease-smoke",
                      )}
                    >
                      <span className="font-display text-2xl font-light text-bone transition-colors duration-400 group-hover:text-gold-light">
                        {p.shortName}
                      </span>
                      <span className="font-sans text-[0.6875rem] uppercase tracking-label text-stone transition-colors duration-400 group-hover:text-gold">
                        {p.notes.base.join(" · ")}
                      </span>
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        )}

        <GoldArc className="mt-16" flip />
      </div>
    </section>
  );
}
