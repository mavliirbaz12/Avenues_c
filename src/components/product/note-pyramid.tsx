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
          <div className="group relative overflow-hidden border border-line bg-surface/60 px-6 py-5 transition-colors duration-600 ease-smoke hover:border-gold/35 sm:px-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(26rem 12rem at 50% 130%, rgba(201,162,75,${
                  0.04 + tier.weight * 0.09
                }), transparent 72%)`,
              }}
            />

            <div className="relative flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="micro-label-gold">{tier.label} notes</p>
              <p className="font-sans text-[0.625rem] uppercase tracking-label text-stone-dark">
                {tier.when}
              </p>
            </div>

            {/* Centred, not left-aligned: the chips are the visual mass of each
                tier, and left-aligning them left a wide void on the right of
                every band — a single-note heart tier looked broken. */}
            <ul className="relative mt-5 flex flex-wrap justify-center gap-2.5">
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
                  <span className="inline-flex items-center gap-2.5 border border-line-strong/70 bg-ink-deep/60 py-2 pl-2.5 pr-4 transition-colors duration-400 ease-smoke group-hover:border-gold/25">
                    <Drop weight={tier.weight} />
                    <span className="font-sans text-[0.8125rem] text-bone">{note}</span>
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
function Drop({ weight }: { weight: number }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-gold" aria-hidden="true">
      <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <circle cx="12" cy="12" r={2.6 + weight * 5.2} fill="currentColor" opacity={0.22 + weight * 0.6} />
    </svg>
  );
}
