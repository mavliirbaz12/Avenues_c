import { SkeletonLine } from "@/components/ui/skeletons";


/**
 * Mirrors the PDP's two-column gallery/buy-box split so the real content lands
 * in the same place the skeleton occupied — no reflow on arrival.
 */
export default function ProductLoading() {
  return (
    <section className="shell grid gap-10 py-10 lg:grid-cols-2 lg:gap-16 lg:py-14">
      {/* Gallery */}
      <div className="flex flex-col gap-4">
        <div className="skeleton aspect-square w-full" />
        <div className="flex gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="skeleton h-20 w-20 shrink-0" />
          ))}
        </div>
      </div>

      {/* Buy box */}
      <div className="flex flex-col gap-5">
        <SkeletonLine className="h-2.5" w="10rem" />
        <SkeletonLine className="h-11" w="min(20rem, 85%)" />
        <SkeletonLine className="h-4" w="14rem" />

        {/* Longevity + concentration chips */}
        <div className="flex gap-3">
          <div className="skeleton h-8 w-24" />
          <div className="skeleton h-8 w-28" />
        </div>

        <SkeletonLine className="mt-2 h-8" w="9rem" />

        {/* Variant selector */}
        <div className="flex gap-3">
          <div className="skeleton h-12 w-24" />
          <div className="skeleton h-12 w-24" />
        </div>

        {/* Add to cart + buy now */}
        <div className="skeleton mt-2 h-14 w-full" />
        <div className="skeleton h-14 w-full" />
      </div>
    </section>
  );
}
