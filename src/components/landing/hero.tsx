"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { HeroMedia } from "./hero-media";
import { RevealLines } from "@/components/motion/reveal";

/**
 * Landing hero — full-bleed media with the type held left.
 *
 * Centred type over centred video is the SaaS-template composition; keeping the
 * headline off-centre against a full-bleed backdrop is the editorial one, and
 * it also guarantees the copy sits over the darkest part of the scrim.
 *
 * One primary CTA only. The design system reserves solid gold for a single
 * button per view, and this is the page's.
 *
 * The negative top margin pulls the section up under the fixed header stack
 * (nav + optional announcement strip), which is why it carries its own top
 * padding. `--header-h` keeps it in step with main's padding automatically.
 */
export function Hero({
  videoUrl,
  posterUrl,
}: {
  videoUrl: string | null;
  posterUrl: string | null;
}) {
  const reduce = useReducedMotion();

  return (
    <section
      className="relative -mt-[var(--header-h)] overflow-hidden bg-ink"
      aria-labelledby="hero-heading"
    >
      <HeroMedia videoUrl={videoUrl} posterUrl={posterUrl} />

      <div className="shell relative z-[2] flex min-h-[clamp(34rem,88dvh,54rem)] flex-col justify-center pb-20 pt-[calc(var(--header-h)+3rem)]">
        <motion.p
          className="micro-label-gold flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.625rem] tracking-[0.24em] sm:text-micro sm:tracking-micro"
          initial={reduce ? undefined : { opacity: 0 }}
          animate={reduce ? undefined : { opacity: 1 }}
          transition={{ duration: 1, delay: 0.1 }}
        >
          <span>Eau de parfum</span>
          <span aria-hidden="true" className="text-gold/45">&middot;</span>
          <span>50ml</span>
          <span aria-hidden="true" className="text-gold/45">&middot;</span>
          <span>Made in India</span>
        </motion.p>

        {/* Two short lines on purpose: each RevealLines entry is a masked row,
            so a line that wraps breaks the stagger rhythm. */}
        <h1 id="hero-heading" className="mt-7 max-w-3xl font-display text-d1 font-light text-bone">
          <RevealLines
            lines={[
              "Arrive a moment",
              <em key="2" className="not-italic text-gradient-gold">
                before you do.
              </em>,
            ]}
          />
        </h1>

        <motion.p
          className="mt-8 max-w-md font-sans text-body-lg leading-relaxed text-stone"
          initial={reduce ? undefined : { opacity: 0, y: 16 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.62, ease: [0.22, 1, 0.36, 1] }}
        >
          Five fragrances, made for Indian weather and long days. Eight to ten
          hours of wear from two sprays. Nothing here fades by lunch.
        </motion.p>

        <motion.div
          className="mt-10"
          initial={reduce ? undefined : { opacity: 0, y: 16 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.76, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Points at the reveal, not the shop grid: the brief wants the
              first CTA to hand you to the motion showpiece rather than skip
              past it. The grid gets its own CTA at the end of the sequence. */}
          <Link href="#reveal" className="btn btn-primary btn-lg">
            Discover
          </Link>
        </motion.div>
      </div>

      {/* Static hairline scroll cue — never a bouncing chevron. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 lg:flex"
        initial={reduce ? undefined : { opacity: 0 }}
        animate={reduce ? undefined : { opacity: 1 }}
        transition={{ duration: 1, delay: 1.4 }}
      >
        <span className="micro-label text-[0.5625rem]">Scroll</span>
        <span className="h-12 w-px bg-gradient-to-b from-gold/50 to-transparent" />
      </motion.div>
    </section>
  );
}
