import { SkeletonLine, SkeletonRows } from "@/components/ui/skeletons";

/**
 * Covers every admin route. Admin pages are `force-dynamic` and each one runs
 * the layout's auth check plus three sidebar count queries before its own work
 * starts, so this is the boundary that stops a click feeling like a hang.
 */
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <SkeletonLine className="h-2.5" w="6rem" />
        <SkeletonLine className="h-8" w="16rem" />
      </div>
      <SkeletonRows rows={8} />
    </div>
  );
}
