"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

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
  showcaseUrl,
}: {
  videoUrl: string | null;
  posterUrl: string | null;
  /**
   * The product photograph shown BESIDE the headline on wide screens.
   *
   * Deliberately not a background: laid behind the type it competed with every
   * line, and no scrim strong enough to fix that left the photograph worth
   * showing. As its own column the picture is fully visible and the words sit
   * on clean ink.
   *
   * On a phone it stacks BELOW the copy rather than disappearing. Most of this
   * store's traffic is mobile, and a hero that shows the product only to
   * desktop visitors gets the priority exactly backwards — the earlier
   * "one idea per phone screen" instinct was wrong here, because the product
   * IS the idea.
   */
  showcaseUrl?: string | null;
}) {
  const reduce = useReducedMotion();

  return (
    <section
      className="relative -mt-[var(--header-h)] overflow-hidden bg-ink"
      aria-labelledby="hero-heading"
    >
      <HeroMedia videoUrl={videoUrl} posterUrl={posterUrl} />

      <div
        className={cn(
          "shell relative z-[2] pt-[calc(var(--header-h)+2rem)] lg:pt-[calc(var(--header-h)+3rem)]",
          showcaseUrl
            ? "min-h-0 pb-16 lg:min-h-[clamp(34rem,88dvh,54rem)] lg:pb-20"
            : "min-h-[clamp(34rem,88dvh,54rem)] pb-20",
          showcaseUrl
            ? "grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-16"
            : "flex flex-col justify-center",
        )}
      >
        <div className="flex flex-col justify-center">
        <motion.p
          className="micro-label-gold flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.625rem] tracking-[0.24em] sm:text-micro sm:tracking-micro"
          initial={reduce ? undefined : { opacity: 0 }}
          animate={reduce ? undefined : { opacity: 1 }}
          transition={{ duration: 1, delay: 0.1 }}
        >
          {/*
            No bottle size here. `sizeLabel` joins every distinct size in the
            catalogue with " & ", so the moment a 20ml or 100ml variant is added
            from admin this line reads "20ml & 50ml & 100ml" — not stale, broken.
            Size is a fact about one product and belongs on that product's page.
          */}
          <span>Eau de parfum</span>
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
          {/* No catalogue count. It goes wrong the day a sixth scent ships, and
              it was never the reason anyone buys. The wear time is. */}
          Made for Indian weather. Eight to ten hours from two sprays.
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

        {showcaseUrl && (
          <motion.div
            className="relative -mx-gutter lg:mx-0"
            initial={reduce ? undefined : { opacity: 0, y: 24 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative aspect-[1600/1283] w-full overflow-hidden">
              <Image
                src={showcaseUrl}
                alt="The Avenues range."
                fill
                priority
                // WAS `(max-width: 1024px) 0px` — written when this image was
                // desktop-only, and never updated when it started stacking on
                // phones. Next took it at its word and served a near-zero-width
                // file, which is why the banner looked blurred on mobile.
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-contain object-center"
              />
            </div>
            {/* Feathers the photograph's edges into the page so it reads as
                part of the hero rather than a pasted rectangle. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(70% 70% at 50% 50%, transparent 55%, rgba(11,11,13,0.85) 100%)",
              }}
            />
          </motion.div>
        )}
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
