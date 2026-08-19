import { ReviewStatus } from "@prisma/client";
import { BadgeCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Stars } from "./stars";
import { ReviewForm } from "./review-form";
import { Reveal } from "@/components/motion/reveal";

/**
 * The reviews band on a product page: aggregate, distribution, the approved
 * reviews, and the submission form. Server component — moderation state and
 * verified-buyer flags never reach the client unvetted.
 *
 * Reads NOTHING about the current visitor, deliberately. It used to call
 * getCurrentUser() to pre-resolve "are you signed in" and "have you already
 * reviewed this", and because this renders inside the product page, that one
 * call made every PDP dynamic — no CDN caching for anybody, to personalise a
 * single panel. The form now resolves sign-in from the client session store,
 * and the duplicate case is caught by the server action, which already returns
 * "You've already reviewed this fragrance" off the unique constraint. Same
 * outcome for the visitor; the page ships from the edge.
 */
export async function ProductReviews({
  productId,
  productName,
  slug,
  avgRating,
  reviewCount,
}: {
  productId: string;
  productName: string;
  slug: string;
  avgRating: number;
  reviewCount: number;
}) {
  const reviews = await prisma.review.findMany({
      where: { productId, status: ReviewStatus.APPROVED },
      orderBy: [{ isVerifiedBuyer: "desc" }, { createdAt: "desc" }],
      take: 20,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        isVerifiedBuyer: true,
        createdAt: true,
        user: { select: { name: true } },
      },
  });

  // Star distribution for the histogram.
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));
  const maxCount = Math.max(1, ...dist.map((d) => d.count));

  return (
    <section id="reviews" className="scroll-mt-[calc(var(--header-h)+2rem)] border-t border-line py-section" aria-labelledby="reviews-heading">
      <div className="shell">
        <Reveal className="text-center">
          <p className="micro-label-gold">Worn and judged</p>
          <h2 id="reviews-heading" className="mt-5 font-display text-d3 font-light text-bone">
            What people say
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Aggregate + form */}
          <div className="lg:col-span-5">
            {reviewCount > 0 ? (
              <div className="border border-line p-6 sm:p-8">
                <div className="flex items-baseline gap-4">
                  <span className="font-display text-6xl font-light text-gradient-gold">
                    {avgRating.toFixed(1)}
                  </span>
                  <div>
                    <Stars rating={avgRating} showCount={false} size="md" />
                    <p className="mt-1.5 font-sans text-xs text-stone">
                      {reviewCount} review{reviewCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-2">
                  {dist.map((d) => (
                    <div key={d.star} className="flex items-center gap-3">
                      <span className="w-3 text-right font-sans text-xs tabular-nums text-stone">
                        {d.star}
                      </span>
                      <div className="h-px flex-1 bg-line-strong">
                        <div
                          className="h-px bg-gold"
                          style={{ width: `${(d.count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="w-4 font-sans text-xs tabular-nums text-stone-dark">
                        {d.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border border-line p-6 text-center sm:p-8">
                <p className="font-display text-2xl font-light text-bone">No reviews yet</p>
                <p className="mx-auto mt-2 max-w-xs font-sans text-sm leading-relaxed text-stone">
                  Be the first — the early reviews are the ones every later
                  buyer reads twice.
                </p>
              </div>
            )}

            <div className="mt-6">
              <ReviewForm productId={productId} productName={productName} slug={slug} />
            </div>
          </div>

          {/* The reviews */}
          <div className="lg:col-span-7">
            {reviews.length === 0 ? (
              <p className="font-sans text-sm leading-relaxed text-stone-dark">
                Approved reviews appear here, newest first, verified buyers on top.
              </p>
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {reviews.map((review) => (
                  <li key={review.id} className="py-7 first:pt-0">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <Stars rating={review.rating} showCount={false} />
                      <span className="font-sans text-sm text-bone">
                        {review.user.name ?? "An Avenues customer"}
                      </span>
                      {review.isVerifiedBuyer && (
                        <span className="inline-flex items-center gap-1.5 font-sans text-[0.625rem] uppercase tracking-label text-gold">
                          <BadgeCheck className="h-3.5 w-3.5" strokeWidth={1.6} />
                          Verified buyer
                        </span>
                      )}
                      <span className="ml-auto font-sans text-xs text-stone-dark">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>

                    {review.title && (
                      <p className="mt-3.5 font-display text-lg font-light text-bone">
                        {review.title}
                      </p>
                    )}
                    <p className="mt-2 whitespace-pre-line font-sans text-[0.9375rem] leading-relaxed text-stone">
                      {review.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
