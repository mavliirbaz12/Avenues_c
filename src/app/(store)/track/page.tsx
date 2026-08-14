import { redirect } from "next/navigation";

/**
 * The public tracking lookup moved to /track-order. This keeps the old path
 * alive — it shipped in the sitemap and may exist in bookmarks — forwarding
 * any ?order= prefill along with it.
 */
export default async function TrackRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const order = (Array.isArray(sp.order) ? sp.order[0] : sp.order) ?? "";
  redirect(order ? `/track-order?order=${encodeURIComponent(order)}` : "/track-order");
}
