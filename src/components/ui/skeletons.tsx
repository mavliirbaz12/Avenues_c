import { cn } from "@/lib/utils";

/**
 * Shared loading skeletons.
 *
 * These exist because every route in this app renders dynamically (auth lives
 * in the store layout), so a click used to block on the full server render —
 * auth, then queries — with the browser still showing the previous page and no
 * sign anything was happening. A `loading.tsx` turns that dead time into an
 * instant response.
 *
 * They deliberately mirror the real layout's proportions rather than being
 * generic grey bars. A skeleton whose shape doesn't match what lands is worse
 * than none: the page visibly reflows the moment content arrives.
 *
 * `.skeleton` (globals.css) carries the gold shimmer.
 *
 * ---------------------------------------------------------------------------
 * WHERE A `loading.tsx` MAY GO — read before adding one
 *
 * A `loading.tsx` is a Suspense boundary, and Next commits the response head
 * as soon as it starts streaming the fallback. Any route UNDER that boundary
 * that later calls `notFound()` therefore serves the 404 UI with a **200**
 * status. For a product page that means Google indexes "Fragrance not found"
 * as a real page. Verified here: with a boundary above it,
 * /fragrance/<unknown> returned 200; with none, 404.
 *
 * So boundaries live only on subtrees where nothing calls `notFound()`:
 *
 *   /shop      ✓  always renders a grid
 *   /account   ✓  guarded by redirect, never notFound
 *   /admin     ✓  its [id] routes DO notFound, accepted deliberately — admin
 *                 is auth-gated and noindex, so the status costs nothing,
 *                 and these are the slowest routes in the app
 *
 *   (store)/            ✗ would shadow /fragrance/[slug] and /order/[n]
 *   fragrance/[slug]/   ✗ 404s on an unknown slug
 *   order/[orderNumber] ✗ 404s on an unknown order
 * ---------------------------------------------------------------------------
 */

export function SkeletonLine({
  className,
  w = "100%",
}: {
  className?: string;
  /** Any CSS width — pass varied values so a stack doesn't look like a barcode. */
  w?: string;
}) {
  return <div className={cn("skeleton h-3", className)} style={{ width: w }} />;
}

/** Eyebrow + heading + two body lines, centred — the house section header. */
export function SkeletonSectionHead() {
  return (
    <div className="flex flex-col items-center gap-5">
      <SkeletonLine className="h-2.5" w="7rem" />
      <SkeletonLine className="h-9" w="min(28rem, 80%)" />
      <div className="flex w-full flex-col items-center gap-2.5">
        <SkeletonLine w="min(24rem, 70%)" />
        <SkeletonLine w="min(18rem, 55%)" />
      </div>
    </div>
  );
}

/** One product card: tall media box, then the meta lines beneath it. */
export function SkeletonProductCard() {
  return (
    <div className="flex flex-col gap-4">
      <div className="skeleton aspect-[4/5] w-full" />
      <SkeletonLine className="h-2.5" w="6rem" />
      <SkeletonLine className="h-5" w="9rem" />
      <SkeletonLine w="5rem" />
    </div>
  );
}

export function SkeletonProductGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-16">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonProductCard key={i} />
      ))}
    </div>
  );
}

/** A table-ish stack of rows, for admin list pages. */
export function SkeletonRows({ rows = 8 }: { rows?: number }) {
  return (
    <div className="border border-line">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-line px-4 py-4 last:border-b-0"
        >
          <div className="skeleton h-10 w-10 shrink-0" />
          <SkeletonLine className="h-4" w={`${7 + ((i * 3) % 6)}rem`} />
          <SkeletonLine className="ml-auto h-4" w="5rem" />
          <SkeletonLine className="hidden h-4 sm:block" w="4rem" />
        </div>
      ))}
    </div>
  );
}
