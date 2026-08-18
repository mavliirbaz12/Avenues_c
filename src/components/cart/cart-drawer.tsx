"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X, ArrowRight } from "lucide-react";
import { CartLineRow } from "./cart-line-row";
import { CartSummary, FreeShippingMeter } from "./cart-summary";
import { CouponField } from "./coupon-field";
import { Sparkle } from "@/components/brand/sparkle";
import { useCart } from "@/store/cart";
import { useUI } from "@/store/ui";
import { usePricedCart } from "@/hooks/use-priced-cart";
import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * Cart drawer.
 *
 * A right-hand panel on desktop and a bottom sheet on mobile — the brief's
 * mobile-first requirement, and the correct ergonomics: on a phone the sheet
 * rises into the thumb zone rather than demanding a reach to the top-right.
 */
export function CartDrawer() {
  const open = useUI((s) => s.cartOpen);
  const close = useUI((s) => s.closeCart);
  const lines = useCart((s) => s.lines);
  const { priced, loading } = usePricedCart();
  const reduce = useReducedMotion();
  const pathname = usePathname();
  const isDesktop = useMediaQuery("(min-width: 640px)");

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const isEmpty = lines.length === 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[65]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <button
            type="button"
            aria-label="Close cart"
            onClick={close}
            className="absolute inset-0 bg-ink-deep/80"
            tabIndex={-1}
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Your cart"
            // Bottom sheet rises on mobile; side panel slides in from the
            // right on desktop. Same component, different vector.
            initial={reduce ? { opacity: 0 } : isDesktop ? { x: "100%" } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0, y: 0 }}
            exit={reduce ? { opacity: 0 } : isDesktop ? { x: "100%" } : { y: "100%" }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col border-x-0 border-b-0
                       sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[26.5rem] sm:border-y-0 sm:border-r-0"
          >
            {/* Grab handle, mobile only */}
            <div className="flex justify-center pt-3 sm:hidden" aria-hidden="true">
              <span className="h-1 w-10 rounded-pill bg-line-strong" />
            </div>

            <header className="flex items-center justify-between px-6 py-5">
              <h2 className="font-display text-2xl font-light text-bone">
                Your cart
                {priced && priced.itemCount > 0 && (
                  <span className="ml-2.5 font-sans text-sm text-stone">({priced.itemCount})</span>
                )}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close cart"
                className="-mr-2 p-2 text-stone transition-colors hover:text-bone"
              >
                <X className="h-5 w-5" strokeWidth={1.4} />
              </button>
            </header>

            <div className="rule" />

            {isEmpty ? (
              <EmptyCart onClose={close} />
            ) : (
              <>
                <div className="flex-1 overflow-y-auto overscroll-contain px-6">
                  {priced?.dropped.length ? (
                    <p className="mt-5 border border-warning/40 bg-warning/[0.06] px-4 py-3 font-sans text-xs leading-relaxed text-warning">
                      {priced.dropped.map((d) => d.name).join(", ")}{" "}
                      {priced.dropped.length === 1 ? "is" : "are"} no longer available and{" "}
                      {priced.dropped.length === 1 ? "was" : "were"} removed.
                    </p>
                  ) : null}

                  <ul className="divide-y divide-line">
                    {(priced?.lines ?? []).map((line) => (
                      <CartLineRow key={line.variantId} line={line} onNavigate={close} compact />
                    ))}
                  </ul>

                  {!priced && loading && (
                    <div className="space-y-4 py-6">
                      {[0, 1].map((i) => (
                        <div key={i} className="flex gap-4">
                          <div className="skeleton h-24 w-20 shrink-0" />
                          <div className="flex-1 space-y-2.5">
                            <div className="skeleton h-4 w-32" />
                            <div className="skeleton h-3 w-16" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rule" />

                <footer className="space-y-5 px-6 py-6">
                  <FreeShippingMeter priced={priced} />
                  <CouponField outcome={priced?.coupon} loading={loading} />
                  <CartSummary priced={priced} loading={loading} />

                  <Link href="/checkout" className="btn btn-primary btn-lg w-full">
                    Checkout
                    <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
                  </Link>
                  <Link
                    href="/cart"
                    className="block text-center font-sans text-micro uppercase text-stone transition-colors hover:text-gold-light"
                  >
                    View full cart
                  </Link>
                </footer>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
      <Sparkle className="h-4 w-4 text-gold/50" />
      <p className="mt-6 font-display text-2xl font-light text-bone">
        Your cart is waiting for its first obsession.
      </p>
      <p className="mt-3 max-w-xs font-sans text-sm leading-relaxed text-stone">
        One of them is going to be yours.
      </p>
      <Link href="/shop" onClick={onClose} className="btn btn-outline btn-md mt-8">
        Shop the range
      </Link>
    </div>
  );
}
