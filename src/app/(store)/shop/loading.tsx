import { SkeletonSectionHead, SkeletonProductGrid } from "@/components/ui/skeletons";

/** Mirrors shop/page.tsx: hero band, filter bar, then the grid. */
export default function ShopLoading() {
  return (
    <>
      <div className="shell py-section">
        <SkeletonSectionHead />
      </div>

      {/* Filter bar — bordered top and bottom, like the real one. */}
      <div className="border-y border-line">
        <div className="shell flex items-center justify-between gap-4 py-4">
          <div className="skeleton h-3 w-28" />
          <div className="skeleton h-9 w-40" />
        </div>
        <div className="shell flex flex-wrap items-center gap-3 border-t border-line py-4">
          <div className="skeleton h-3 w-8" />
          {["4rem", "4rem", "5rem"].map((w, i) => (
            <div key={i} className="skeleton h-9" style={{ width: w }} />
          ))}
        </div>
      </div>

      <div className="shell py-section">
        <SkeletonProductGrid count={6} />
      </div>
    </>
  );
}
