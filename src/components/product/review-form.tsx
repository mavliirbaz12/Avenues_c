"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { submitReview, REVIEW_IDLE } from "@/app/actions/reviews";
import { Sparkle } from "@/components/brand/sparkle";
import { cn } from "@/lib/utils";

export function ReviewForm({
  productId,
  productName,
  isAuthed,
  alreadyReviewed,
  slug,
}: {
  productId: string;
  productName: string;
  isAuthed: boolean;
  alreadyReviewed: boolean;
  slug: string;
}) {
  const [state, action] = useActionState(submitReview, REVIEW_IDLE);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  if (!isAuthed) {
    return (
      <div className="border border-line p-6 text-center">
        <p className="font-sans text-sm leading-relaxed text-stone">
          Worn {productName}?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(`/fragrance/${slug}`)}`}
            className="text-gold underline underline-offset-4 transition-colors hover:text-gold-light"
          >
            Sign in
          </Link>{" "}
          to leave a review — accounts keep the ratings honest.
        </p>
      </div>
    );
  }

  if (alreadyReviewed) {
    return (
      <div className="border border-line p-6 text-center">
        <p className="font-sans text-sm leading-relaxed text-stone">
          You&rsquo;ve reviewed this fragrance — thank you. One review per
          customer keeps the numbers honest.
        </p>
      </div>
    );
  }

  if (state.ok) {
    return (
      <div className="border border-gold/25 bg-gold/[0.04] p-6 text-center" role="status">
        <Sparkle className="mx-auto h-3 w-3 text-gold" />
        <p className="mt-3 font-sans text-sm leading-relaxed text-gold-light">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="border border-line p-6 sm:p-8">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating} />

      <p className="font-display text-xl font-light text-bone">Review {productName}</p>

      {/* Star picker */}
      <fieldset className="mt-5">
        <legend className="field-label">Your rating</legend>
        <div
          className="flex gap-1.5"
          onMouseLeave={() => setHover(0)}
          role="radiogroup"
          aria-label="Rating out of five"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              className="p-1"
            >
              <svg
                viewBox="0 0 24 24"
                className={cn(
                  "h-6 w-6 transition-colors duration-200",
                  (hover || rating) >= n ? "text-gold" : "text-stone-dark",
                )}
              >
                <path
                  d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.45 6.19 20.5 7.3 14.03 2.6 9.45l6.5-.95z"
                  fill={(hover || rating) >= n ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </div>
        {state.fieldErrors?.rating && (
          <span className="field-msg-error">{state.fieldErrors.rating}</span>
        )}
      </fieldset>

      <div className="mt-5">
        <label htmlFor="rv-title" className="field-label">
          Title (optional)
        </label>
        <input
          id="rv-title"
          name="title"
          maxLength={120}
          placeholder="Sums it up in a line"
          className="field"
        />
      </div>

      <div className="mt-5">
        <label htmlFor="rv-body" className="field-label">
          Your review
        </label>
        <textarea
          id="rv-body"
          name="body"
          required
          rows={5}
          placeholder="What does it smell like on you? How long did it last? Where would you wear it?"
          aria-invalid={state.fieldErrors?.body ? true : undefined}
          className={cn("field resize-y", state.fieldErrors?.body && "field-error")}
        />
        {state.fieldErrors?.body && (
          <span className="field-msg-error">{state.fieldErrors.body}</span>
        )}
      </div>

      {state.message && !state.ok && (
        <p className="mt-4 font-sans text-sm text-danger" role="alert">
          {state.message}
        </p>
      )}

      <Submit disabled={rating === 0} />
    </form>
  );
}

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="btn btn-outline btn-md mt-6"
    >
      {pending ? "Submitting" : "Submit review"}
    </button>
  );
}
