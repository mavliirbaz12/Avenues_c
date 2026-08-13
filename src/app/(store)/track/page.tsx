import type { Metadata } from "next";
import { TrackOrderForm } from "@/components/orders/track-order-form";
import { GoldArc } from "@/components/brand/gold-arc";

export const metadata: Metadata = {
  title: "Track your order",
  description:
    "Follow your Avenues order from our door to yours — no account needed, just your order number and the email or phone you used.",
};

/**
 * Public tracking lookup. A guest proves they own an order by pairing its
 * number with the email or phone used at checkout; success redirects to the
 * full order page with its access token.
 */
export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const prefill = (Array.isArray(sp.order) ? sp.order[0] : sp.order) ?? "";

  return (
    <div className="shell mx-auto max-w-lg py-16 sm:py-24">
      <header className="text-center">
        <p className="micro-label-gold">Order journey</p>
        <h1 className="mt-5 font-display text-d3 font-light text-bone">Track your order</h1>
        <p className="mx-auto mt-4 max-w-sm font-sans text-[0.9375rem] leading-relaxed text-stone">
          Your order number is in the confirmation email — it looks like
          AVN-XXXXXX. Pair it with the email or phone you ordered with.
        </p>
        <GoldArc className="mt-8" />
      </header>

      <div className="mt-10">
        <TrackOrderForm prefillOrderNumber={prefill} />
      </div>
    </div>
  );
}
