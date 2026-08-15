import { SkeletonLine, SkeletonRows } from "@/components/ui/skeletons";

/**
 * Account pages are behind `requireUser`, so every navigation pays a JWT
 * decode plus the page's own queries before anything paints.
 *
 * Safe to put a boundary here: nothing under /account calls `notFound()`. See
 * the note in src/components/ui/skeletons.tsx for why that matters.
 */
export default function AccountLoading() {
  return (
    <div className="shell py-section">
      <SkeletonLine className="h-2.5" w="7rem" />
      <SkeletonLine className="mt-4 h-9" w="14rem" />
      <div className="mt-10">
        <SkeletonRows rows={5} />
      </div>
    </div>
  );
}
