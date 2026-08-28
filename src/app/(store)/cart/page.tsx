"use client";

import Link from "next/link";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { CartLineRow } from "@/components/cart/cart-line-row";
import { CartSummary, FreeShippingMeter } from "@/components/cart/cart-summary";
import { CouponField } from "@/components/cart/coupon-field";
import { Sparkle } from "@/components/brand/sparkle";
import { GoldArc } from "@/components/brand/gold-arc";
import { useCart } from "@/store/cart";
import { usePricedCart } from "@/hooks/use-priced-cart";

/**
 * Full cart page. Client-rendered because the cart lives in localStorage for
 * guests — but every figure shown comes from /api/cart/price, not from the
 * browser. Metadata for this route is set in the sibling layout, since a
 * client component cannot export it.
 */
export default function CartPage() {
  const lines = useCart((s) => s.lines);
  const { priced, loading } = usePricedCart();

  if (lines.length === 0) {
    return (
      <div className="shell py-24 text-center sm:py-36">
        <Sparkle className="mx-auto h-4 w-4 text-gold/50" />
        <h1 className="mt-7 font-display text-d3 font-light text-bone">
          Your cart is waiting for its first obsession.
        </h1>
        <p className="mx-auto mt-5 max-w-md font-sans text-body-lg leading-relaxed text-stone">
          Somewhere in the range is the one people will start associating with
          you.
        </p>
        <Link href="/shop" className="btn btn-primary btn-lg mt-10">
          Shop the range
        </Link>
      </div>
    );
  }

  return (
    <div className="shell py-14 sm:py-20">
      <header className="text-center">
        <p className="micro-label-gold">Almost yours</p>
        <h1 className="mt-5 font-display text-d2 font-light text-bone">Your cart</h1>
        <GoldArc className="mt-8" />
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-12 lg:gap-16">
        <section className="lg:col-span-7" aria-label="Cart items">
          {priced?.dropped.length ? (
            <p className="mb-6 border border-warning/40 bg-warning/[0.06] px-4 py-3 font-sans text-sm leading-relaxed text-warning">
              {priced.dropped.map((d) => d.name).join(", ")}{" "}
              {priced.dropped.length === 1 ? "is" : "are"} no longer available and{" "}
              {priced.dropped.length === 1 ? "was" : "were"} removed from your cart.
            </p>
          ) : null}

          <ul className="divide-y divide-line border-y border-line">
            {(priced?.lines ?? []).map((line) => (
              <CartLineRow key={line.variantId} line={line} />
            ))}
          </ul>

          {!priced && loading && (
            <div className="space-y-5 py-6">
              {[0, 1].map((i) => (
                <div key={i} className="flex gap-4">
                  <div className="skeleton h-32 w-28 shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div className="skeleton h-5 w-40" />
                    <div className="skeleton h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link
            href="/shop"
            className="group mt-8 inline-flex items-center gap-3 font-sans text-micro uppercase text-stone transition-colors hover:text-gold-light"
          >
            <ArrowLeft
              className="h-4 w-4 transition-transform duration-500 ease-smoke group-hover:-translate-x-1"
              strokeWidth={1.4}
            />
            Continue shopping
          </Link>
        </section>

        <aside className="lg:col-span-5">
          <div className="card space-y-6 p-6 sm:p-8 lg:sticky lg:top-[calc(var(--header-h)+2rem)]">
            <h2 className="font-display text-2xl font-light text-bone">Summary</h2>
            <FreeShippingMeter priced={priced} />
            <CouponField outcome={priced?.coupon} loading={loading} />
            <CartSummary priced={priced} loading={loading} />

            <Link href="/checkout" className="btn btn-primary btn-lg w-full">
              Proceed to checkout
              <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
            </Link>

            <p className="text-center font-sans text-xs leading-relaxed text-stone-dark">
              Cash on delivery available. Delivered across India by Delhivery.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
