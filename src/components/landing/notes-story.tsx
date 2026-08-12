"use client";

import { motion, useReducedMotion } from "motion/react";
import { Reveal } from "@/components/motion/reveal";
import { GoldArc } from "@/components/brand/gold-arc";
import { cn } from "@/lib/utils";

/**
 * "How a fragrance is built" — the note pyramid, explained.
 *
 * This teaches the concept rather than describing one product (the per-product
 * pyramid lives on the PDP). Three bands widen as they descend, so the shape
 * itself is the pyramid — no diagram, no icons, no clip art. The bands draw
 * outward from the centre as they enter the viewport.
 */

const TIERS = [
  {
    key: "top",
    label: "Top",
    when: "First 15 minutes",
    width: "56%",
    title: "The opening",
    body: "The lightest molecules, and the first thing anyone smells. Citrus, herbs, cool spice. They are gone quickly by design — their job is to make you lean in.",
    examples: "Bergamot · Apple · Saffron · Peony",
  },
  {
    key: "heart",
    label: "Heart",
    when: "One to three hours",
    width: "78%",
    title: "The character",
    body: "What the fragrance actually is. Florals and warm spice arrive as the top notes burn off, and this is the accord people will recognise on you across a room.",
    examples: "Rose · Orange blossom · Oud · Osmanthus",
  },
  {
    key: "base",
    label: "Base",
    when: "Three to ten hours",
    width: "100%",
    title: "The memory",
    body: "Heavy, slow molecules that cling to skin and fabric. Amber, woods, musk, vanilla. This is the part still on a collar the next morning.",
    examples: "Amber · Sandalwood · Musk · Tonka bean",
  },
];

export function NotesStory() {
  const reduce = useReducedMotion();

  return (
    <section id="notes" className="relative scroll-mt-24 py-section" aria-labelledby="notes-heading">
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
            What you smell in the shop is not what you wear at dinner. Perfume
            unfolds in tiers, and knowing which tier you are smelling is most of
            the education.
          </p>
        </Reveal>

        <div className="mx-auto mt-16 max-w-4xl space-y-5 lg:mt-20">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.key}
              className="mx-auto"
              style={{ maxWidth: tier.width }}
              initial={reduce ? undefined : { opacity: 0, scaleX: 0.86, y: 18 }}
              whileInView={reduce ? undefined : { opacity: 1, scaleX: 1, y: 0 }}
              viewport={{ once: true, margin: "-15%" }}
              transition={{ duration: 1, delay: i * 0.14, ease: [0.22, 1, 0.36, 1] }}
            >
              <div
                className={cn(
                  "group relative overflow-hidden border border-line bg-surface/70 p-7 transition-colors duration-600 ease-smoke hover:border-gold/35 sm:p-9",
                )}
              >
                {/* Warmth increases as you descend the pyramid. */}
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

                <h3 className="relative mt-4 font-display text-d5 font-light text-bone">
                  {tier.title}
                </h3>
                <p className="relative mt-3 font-sans text-[0.9375rem] leading-relaxed text-stone">
                  {tier.body}
                </p>
                <p className="relative mt-4 font-sans text-xs tracking-wide2 text-stone-dark">
                  {tier.examples}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <GoldArc className="mt-16" flip />
      </div>
    </section>
  );
}
