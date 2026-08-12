"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { Reveal } from "@/components/motion/reveal";
import type { ProductCard as ProductCardData } from "@/lib/catalog";

/**
 * The featured strip.
 *
 * A scroll-snapped rail rather than a grid, deliberately: five products divide
 * badly into any column count (3+2 always looks like a mistake), and a rail
 * absorbs a sixth or seventh launch without a layout decision. The desktop
 * arrows only appear when there is actually something to scroll to.
 */
export function FeaturedCollection({
  products,
  title,
  subtitle,
  eyebrow,
}: {
  products: ProductCardData[];
  title: string;
  subtitle?: string;
  eyebrow: string;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const update = () => {
      setCanPrev(el.scrollLeft > 8);
      setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [products.length]);

  function nudge(dir: 1 | -1) {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 420), behavior: "smooth" });
  }

  if (products.length === 0) return null;

  return (
    <section className="py-section" aria-labelledby="featured-heading">
      <div className="shell">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="micro-label-gold">{eyebrow}</p>
              <h2
                id="featured-heading"
                className="mt-5 max-w-lg font-display text-d3 font-light text-bone"
              >
                {title}
              </h2>
              {subtitle && (
                <p className="mt-4 max-w-md font-sans text-body-lg leading-relaxed text-stone">
                  {subtitle}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <RailButton onClick={() => nudge(-1)} disabled={!canPrev} label="Previous">
                <ArrowLeft className="h-4 w-4" strokeWidth={1.4} />
              </RailButton>
              <RailButton onClick={() => nudge(1)} disabled={!canNext} label="Next">
                <ArrowRight className="h-4 w-4" strokeWidth={1.4} />
              </RailButton>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Bleeds into the gutter so cards run to the screen edge on mobile. */}
      <div
        ref={railRef}
        className="no-scrollbar mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto px-gutter pb-2
                   [scroll-padding-left:var(--gutter,1.25rem)] lg:mt-14"
      >
        {products.map((p, i) => (
          <div
            key={p.id}
            className="w-[74vw] shrink-0 snap-start sm:w-[44vw] lg:w-[clamp(18rem,24vw,22rem)]"
          >
            <ProductCard product={p} index={i + 1} priority={i < 2} />
          </div>
        ))}

        <div className="flex w-[52vw] shrink-0 snap-start items-center sm:w-[30vw] lg:w-[16rem]">
          <Link
            href="/shop"
            className="group flex h-full w-full flex-col items-center justify-center gap-4
                       border border-line px-6 py-16 text-center transition-colors duration-600
                       ease-smoke hover:border-gold/40"
          >
            <span className="font-display text-3xl font-light text-bone transition-colors group-hover:text-gold-light">
              All five
            </span>
            <span className="micro-label">Shop the range</span>
            <ArrowRight
              className="h-4 w-4 text-gold transition-transform duration-600 ease-smoke group-hover:translate-x-1.5"
              strokeWidth={1.4}
            />
          </Link>
        </div>
      </div>
    </section>
  );
}

function RailButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-11 w-11 items-center justify-center border border-line text-stone
                 transition-colors duration-400 ease-smoke hover:border-gold/40 hover:text-gold-light
                 disabled:pointer-events-none disabled:opacity-25"
    >
      {children}
    </button>
  );
}
