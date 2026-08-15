import { SkeletonSectionHead, SkeletonProductGrid } from "@/components/ui/skeletons";

/**
 * Fallback for any storefront route without its own. Deliberately generic —
 * a section header over a product grid, which is the shape of most pages here.
 */
export default function StoreLoading() {
  return (
    <div className="shell py-section">
      <SkeletonSectionHead />
      <div className="mt-14">
        <SkeletonProductGrid count={3} />
      </div>
    </div>
  );
}
