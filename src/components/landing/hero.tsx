"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { BottleFigure } from "@/components/brand/bottle-figure";
import { RevealLines } from "@/components/motion/reveal";


/**
 * Landing hero — the "ledger" layout.
 *
 * A 7/5 asymmetric split on desktop: oversized headline against a single lit
 * bottle. On mobile it restacks to label → headline → bottle → actions, so the
 * type still lands first and the call to action stays above the fold.
 *
 * The nav floats transparently over this section (the negative top margin
 * pulls the hero up under it), which is why the section carries its own top
 * padding.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Restrained parallax: the bottle drifts a little slower than the page and
  // fades as it leaves. Anything more reads as a gimmick.
  const bottleY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const bottleOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.25]);
  const haloScale = useTransform(scrollYProgress, [0, 1], [1, 1.18]);

  return (
    <section
      ref={ref}
      className="relative -mt-[var(--nav-h)] overflow-hidden bg-ink grain"
      aria-labelledby="hero-heading"
    >
      {/* A single warm light source, off to the right, behind the glass. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 46rem at 72% 38%, rgba(201,162,75,0.10), transparent 62%)",
        }}
      />

      {/* Full viewport height only from lg up. Below that the stacked layout
          already exceeds a screen, and forcing 100dvh opened a dead gap
          between the call to action and the bottle. */}
      <div className="shell relative z-[2] grid items-center gap-10 pb-16 pt-[calc(var(--nav-h)+2.5rem)] sm:pb-20 lg:min-h-[calc(100dvh-var(--nav-h))] lg:grid-cols-12 lg:gap-8 lg:pb-28">
        {/* Type */}
        <div className="order-1 lg:col-span-7">
          <motion.p
            className="micro-label-gold flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.625rem] tracking-[0.24em] sm:text-micro sm:tracking-micro"
            initial={reduce ? undefined : { opacity: 0 }}
            animate={reduce ? undefined : { opacity: 1 }}
            transition={{ duration: 1, delay: 0.1 }}
          >
            {/* Middot rather than the star: below ~10px the four-pointed mark
                degrades into a plus sign. The star is used at larger sizes. */}
            <span>Eau de parfum</span>
            <span aria-hidden="true" className="text-gold/45">
              &middot;
            </span>
            <span>50ml</span>
            <span aria-hidden="true" className="text-gold/45">
              &middot;
            </span>
            <span>Made in India</span>
          </motion.p>

          {/* Two short lines on purpose: each RevealLines entry is a masked
              row, so a line that wraps breaks the stagger rhythm. */}
          <h1
            id="hero-heading"
            className="mt-7 font-display text-d1 font-light text-bone"
          >
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
            className="mt-10 flex flex-wrap items-center gap-3"
            initial={reduce ? undefined : { opacity: 0, y: 16 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.76, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link href="/shop" className="btn btn-primary btn-lg">
              Shop the five
            </Link>
            <Link href="#notes" className="btn btn-ghost btn-lg">
              How they're built
            </Link>
          </motion.div>
        </div>

        {/* Bottle */}
        <motion.div
          className="order-2 lg:col-span-5"
          style={reduce ? undefined : { y: bottleY, opacity: bottleOpacity }}
        >
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[15rem] sm:max-w-[18rem] lg:max-w-none">
            <motion.div
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center"
              style={reduce ? undefined : { scale: haloScale }}
            >
              {/* The logo ring, blown up and set behind the bottle. */}
              <svg viewBox="0 0 100 100" className="h-[86%] w-[86%] text-gold/20">
                <path
                  d="M69.4 14.2 A43 43 0 1 1 30.6 14.2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.35"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </motion.div>

            <motion.div
              className="relative h-full w-full"
              initial={reduce ? undefined : { opacity: 0, y: 28 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 1.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <BottleFigure slug="night-drip" alt="An Avenues eau de parfum bottle" />
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Scroll cue */}
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
