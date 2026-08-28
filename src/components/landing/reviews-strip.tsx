import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { Stars } from "@/components/product/stars";
import { Reveal } from "@/components/motion/reveal";
import { productHref, type HomeReview } from "@/lib/catalog";

/**
 * What customers actually said, across the whole catalogue.
 *
 * The landing page could describe the fragrances at length and had nowhere for
 * anyone else to speak. Every reference brand checked — buyoctopus, sarkar,
 * therizz — carries a review rail on the home page, and therizz puts a rating
 * claim in its benefit tiles as well. It is the one section a brand cannot
 * write itself, which is exactly why it carries weight.
 *
 * A HORIZONTAL RAIL, not a grid. Reviews are read one at a time and a grid of
 * them turns into a wall of small text that gets skipped. The rail also means
 * the section costs a fixed amount of page height no matter how many reviews
 * exist — which matters, because this page is already long and the brief was
 * that people get bored scrolling.
 *
 * The pattern is the one already in social-strip.tsx: overflow-x on touch,
 * grid from `sm`.
 */

/**
 * Below this, the section renders nothing at all.
 *
 * A carousel holding one review says "nobody has bought this" more loudly than
 * an absent section says anything. Three is the point where it reads as a
 * pattern rather than an anecdote. This is a young store, so it will be empty
 * for a while, and empty is the correct state until it is not.
 */
const MIN_REVIEWS = 3;

export function ReviewsStrip({ reviews }: { reviews: HomeReview[] }) {
  if (reviews.length < MIN_REVIEWS) return null;

  return (
    <section className="py-section" aria-labelledby="reviews-heading">
      <div className="shell text-center">
        <Reveal>
          <p className="micro-label-gold">Worn and judged</p>
          <h2
            id="reviews-heading"
            className="mt-5 font-display text-d3 font-light text-bone"
          >
            What people say
          </h2>
        </Reveal>
      </div>

      <div
        className="no-scrollbar mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-gutter
                   sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3"
      >
        {reviews.slice(0, 6).map((r, i) => (
          <Reveal
            key={r.id}
            delay={i * 0.05}
            className="w-[78vw] shrink-0 snap-center sm:w-auto"
          >
            <figure className="flex h-full flex-col border border-line bg-surface/40 p-6">
              <Stars rating={r.rating} showCount={false} size="sm" />

              {r.title && (
                <figcaption className="mt-4 font-display text-lg font-light text-bone">
                  {r.title}
                </figcaption>
              )}

              {/*
                Clamped to four lines. A rail's cards have to be the same height
                to scan, and someone who wrote six paragraphs should not set the
                height of everyone else's card. The full text is on the product
                page, which is where a reader who wants it is going anyway.
              */}
              <blockquote className="mt-2.5 line-clamp-4 font-sans text-[0.9375rem] leading-relaxed text-stone">
                {r.body}
              </blockquote>

              <div className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-line pt-4 font-sans text-xs text-stone-dark">
                {/* First name only — a surname on a public page is more than
                    anyone agreed to when they left a review. */}
                <span className="text-stone">
                  {r.user?.name?.trim().split(/\s+/)[0] ?? "Verified customer"}
                </span>

                {r.isVerifiedBuyer && (
                  <span className="inline-flex items-center gap-1 text-gold">
                    <BadgeCheck className="h-3.5 w-3.5" strokeWidth={1.6} />
                    Verified buyer
                  </span>
                )}

                <span aria-hidden="true">&middot;</span>

                <Link
                  href={productHref(r.product)}
                  className="transition-colors hover:text-gold-light"
                >
                  {r.product.name.replace(/^Avenues\s+/i, "")}
                </Link>
              </div>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
