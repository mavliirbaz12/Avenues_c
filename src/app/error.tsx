"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";

/**
 * What a customer sees when a page throws in production.
 *
 * Without this file Next renders its own fallback, which in a production build
 * is an unstyled white page reading "Application error: a server-side exception
 * has occurred". It carries no branding, no way back, and no indication whether
 * the problem is the customer's or ours — someone mid-checkout would reasonably
 * assume their money had gone somewhere.
 *
 * The digest is shown deliberately. Next strips real error messages from
 * production output on purpose (they leak schema and file paths), leaving a
 * hash that also appears in the Vercel log line for the same request. Printing
 * it is what turns "the site broke" into a support message that can actually be
 * traced to one request.
 *
 * `reset()` re-renders the segment without a full page load. A surprising share
 * of production errors are transient — a database connection that dropped, a
 * cold start that timed out — so offering the retry first is honest rather than
 * hopeful.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Reaches the Vercel runtime logs, where it can be correlated with the
    // digest. Replace with a monitoring SDK when one is added.
    console.error("[route error]", error.digest, error.message);
  }, [error]);

  return (
    <div className="shell flex min-h-[60vh] flex-col items-center justify-center py-section text-center">
      <BrandMark className="h-14 w-auto opacity-80" />

      <h1 className="mt-8 font-display text-d3 font-light text-bone">
        Something went wrong at our end
      </h1>

      <p className="mt-4 max-w-md font-sans text-body-lg leading-relaxed text-stone">
        Not something you did. The page failed to load — trying again often
        works, and nothing you were doing has been lost.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className="btn btn-primary btn-lg">
          Try again
        </button>
        <Link href="/" className="btn btn-ghost btn-lg">
          Back to the store
        </Link>
      </div>

      {error.digest && (
        <p className="mt-10 font-sans text-xs text-stone-dark">
          If you contact us, quote reference{" "}
          <span className="text-stone">{error.digest}</span>
        </p>
      )}
    </div>
  );
}
