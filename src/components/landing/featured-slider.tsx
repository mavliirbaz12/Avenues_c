"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BottleFigure } from "@/components/brand/bottle-figure";
import { formatPaise } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductCard } from "@/lib/catalog";

const INTERVAL_MS = 8000;

/**
 * The featured fragrance, one at a time.
 *
 * Built as an instrument rather than a carousel, deliberately:
 *  - CROSSFADE, never a horizontal slide. Sliding panels is the single most
 *    generic device on the web and it fights the "slow smoke" brief.
 *  - 8s dwell, not 4 — long enough to actually read.
 *  - Pauses on hover, on keyboard focus, and when the tab is hidden. Under
 *    prefers-reduced-motion it never auto-advances at all (WCAG 2.2.2).
 *  - The position indicator is the site's own numeric device (01 / 05, matching
 *    the zero-padded index on product cards) plus a hairline progress gauge —
 *    not a row of dots.
 *  - The tagline is set SMALL in letter-spaced caps. Three caps words in the
 *    display serif would read as luxury-template and fight the name for weight.
 */
export function FeaturedSlider({ products }: { products: ProductCard[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  const regionRef = useRef<HTMLDivElement>(null);

  const total = products.length;
  const go = useCallback(
    (next: number) => setIndex(((next % total) + total) % total),
    [total],
  );

  // Auto-advance. Disabled entirely under reduced motion.
  useEffect(() => {
    if (reduce || paused || total < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % total), INTERVAL_MS);
    return () => clearInterval(t);
  }, [reduce, paused, total]);

  // A background tab must not rotate.
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (total === 0) return null;
  const product = products[index]!;
  const variant = product.defaultVariant;

  return (
    <section className="border-y border-line bg-ink-deep py-section" aria-labelledby="featured-heading">
      <h2 id="featured-heading" className="sr-only">
        Featured fragrance
      </h2>

      <div
        ref={regionRef}
        className="shell"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={(e) => {
          if (!regionRef.current?.contains(e.relatedTarget as Node)) setPaused(false);
        }}
      >
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
          {/* Bottle */}
          <div className="lg:col-span-5">
            <div className="relative mx-auto aspect-[3/4] w-full max-w-[18rem] lg:max-w-none">
              <AnimatePresence mode="wait">
                <motion.div
                  key={product.slug}
                  className="absolute inset-0"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0.2 : 1.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  {product.image ? (
                    <Image
                      src={product.image.url}
                      alt={product.image.alt || product.name}
                      fill
                      sizes="(max-width: 1024px) 60vw, 32vw"
                      className="object-contain"
                    />
                  ) : (
                    <BottleFigure slug={product.slug} alt={`${product.name} bottle`} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Copy */}
          <div className="lg:col-span-7">
            <p className="micro-label-gold">The house recommends</p>

            <AnimatePresence mode="wait">
              <motion.div
                key={product.slug}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: reduce ? 0.2 : 0.9, ease: [0.22, 1, 0.36, 1] }}
              >
                <h3 className="mt-5 font-display text-d2 font-light text-bone">
                  {product.shortName}
                </h3>

                <p className="mt-4 font-sans text-micro uppercase tracking-micro text-gold">
                  {product.tagline}
                </p>

                <p className="mt-6 max-w-md font-sans text-body-lg leading-relaxed text-stone">
                  {product.highlight}
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-5">
                  <Link href={product.href} className="btn btn-outline btn-lg">
                    Explore the fragrance
                  </Link>
                  {variant && (
                    <span className="font-sans text-sm text-stone">
                      <span className="money">{formatPaise(variant.pricePaise)}</span>
                      <span className="text-stone-dark"> · {variant.size}</span>
                    </span>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Controls */}
            {total > 1 && (
              <div className="mt-12 flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <SliderButton onClick={() => go(index - 1)} label="Previous fragrance">
                    <ArrowLeft className="h-4 w-4" strokeWidth={1.4} />
                  </SliderButton>
                  <SliderButton onClick={() => go(index + 1)} label="Next fragrance">
                    <ArrowRight className="h-4 w-4" strokeWidth={1.4} />
                  </SliderButton>
                </div>

                <span className="font-sans text-micro tabular-nums text-stone">
                  {String(index + 1).padStart(2, "0")}
                  <span className="text-stone-dark"> / {String(total).padStart(2, "0")}</span>
                </span>

                {/* Hairline gauge — reads as a measure, not a spinner. */}
                <span className="relative h-px flex-1 max-w-[10rem] bg-line-strong">
                  <motion.span
                    key={`${index}-${paused}-${reduce}`}
                    className="absolute inset-y-0 left-0 bg-gold"
                    initial={{ width: "0%" }}
                    animate={{ width: reduce || paused ? "0%" : "100%" }}
                    transition={{
                      duration: reduce || paused ? 0 : INTERVAL_MS / 1000,
                      ease: "linear",
                    }}
                  />
                </span>
              </div>
            )}
          </div>
        </div>

        <p aria-live="polite" className="sr-only">
          {product.name}, fragrance {index + 1} of {total}
        </p>
      </div>
    </section>
  );
}

function SliderButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center border border-line text-stone",
        "transition-colors duration-400 ease-smoke hover:border-gold/40 hover:text-gold-light",
      )}
    >
      {children}
    </button>
  );
}
