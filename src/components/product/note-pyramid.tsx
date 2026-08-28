"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * The fragrance pyramid — the reference feature of the product page.
 *
 * Three tiers, each a band that widens as it descends, so the arrangement
 * itself is the pyramid. Every note gets a chip carrying a small "drop"
 * glyph built from the logo's ring; the drop fills and warms tier by tier,
 * which encodes volatility visually: top notes read light and open, base
 * notes read solid and dense.
 *
 * No icons, no clip art, no emoji — the whole thing is type, hairlines and
 * one repeated brand shape.
 */

type Tier = {
  key: "top" | "heart" | "base";
  label: string;
  when: string;
  notes: string[];
  /** 0-1: how filled the drop glyph is, and how warm the band glows. */
  weight: number;
  width: string;
};

export function NotePyramid({
  top,
  heart,
  base,
  className,
}: {
  top: string[];
  heart: string[];
  base: string[];
  className?: string;
}) {
  const reduce = useReducedMotion();

  // Annotated before filtering — filtering first widens `key` to string and
  // loses the union.
  const allTiers: Tier[] = [
    { key: "top", label: "Top", when: "First 15 minutes", notes: top, weight: 0.18, width: "62%" },
    { key: "heart", label: "Heart", when: "One to three hours", notes: heart, weight: 0.5, width: "82%" },
    { key: "base", label: "Base", when: "Three to ten hours", notes: base, weight: 1, width: "100%" },
  ];
  const tiers = allTiers.filter((t) => t.notes.length > 0);

  return (
    <div className={cn("mx-auto w-full max-w-3xl space-y-4", className)}>
      {tiers.map((tier, i) => (
        <motion.div
          key={tier.key}
          className="mx-auto w-full"
          style={{ maxWidth: tier.width }}
          initial={reduce ? undefined : { opacity: 0, scaleX: 0.88, y: 16 }}
          whileInView={reduce ? undefined : { opacity: 1, scaleX: 1, y: 0 }}
          viewport={{ once: true, margin: "-12%" }}
          transition={{ duration: 0.95, delay: i * 0.16, ease: [0.22, 1, 0.36, 1] }}
        >
          {/*
            ONE frame, not two.

            This was a bordered panel per tier with every single note inside it
            wrapped in its own bordered chip — a box around a box around a word.
            Three tiers of that is fifteen rectangles competing with the notes
            they were meant to present, and it is the specific thing that made
            this page feel boxy.

            The tier keeps a top hairline to separate it and nothing else. The
            notes are set as type, which is how the reference sites present
            theirs and how a perfume house prints them on a card.
          */}
          <div className="group relative border-t border-line px-1 py-6 sm:py-7">
            {/* The radial glow that used to sit here was lighting the inside of
                a bordered panel. With the panel gone its edges read as a stray
                rectangle behind the type — the exact boxiness this was meant to
                remove. */}

            <div className="relative flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="micro-label-gold">{tier.label} notes</p>
              <p className="font-sans text-[0.625rem] uppercase tracking-label text-stone-dark">
                {tier.when}
              </p>
            </div>

            <ul className="relative mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              {tier.notes.map((note, n) => (
                <motion.li
                  key={note}
                  initial={reduce ? undefined : { opacity: 0, y: 8 }}
                  whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.6,
                    delay: i * 0.16 + 0.2 + n * 0.06,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <span className="inline-flex items-baseline gap-2.5">
                    {n > 0 && (
                      <span aria-hidden="true" className="text-gold/35">
                        &middot;
                      </span>
                    )}
                    <span className="font-display text-lg font-light text-bone">{note}</span>
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/** The brand ring, filled in proportion to how heavy the note is. */
