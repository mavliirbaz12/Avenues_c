"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X, ArrowRight, ChevronDown } from "lucide-react";
import { CartLineRow } from "./cart-line-row";
import { CartSummary, FreeShippingMeter } from "./cart-summary";
import { Sparkle } from "@/components/brand/sparkle";
import { useCart } from "@/store/cart";
import { useUI } from "@/store/ui";
import { usePricedCart, type PricedCartDTO } from "@/hooks/use-priced-cart";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

/**
 * Cart — a centred modal on desktop, a full-height panel on phones.
 *
 * THE SPLIT IS DELIBERATE, and the note below is why. A centred box needs
 * margin on all four sides, so it can never be full height — which is exactly
 * the constraint that made the old bottom sheet unusable. On a desktop viewport
 * there is height to spare and the modal reads better. On a phone there is not,
 * so the panel keeps the whole screen and the modal styling.
 *
 * Everything below is the original reasoning, and it still governs the phone
 * layout:
 *
 * It used to be a bottom sheet on phones, capped at `88dvh`, with the
 * free-shipping meter, the coupon field and the whole money column stacked in
 * a fixed footer. Measured at 400x767 that footer was 245px and the header
 * 76px, so of the 675px the sheet was allowed, the item list got about 340px —
 * two and a half rows, whatever the cart held. A customer with five things in
 * their cart opened it and saw one, with no sign the others existed. The sheet
 * also threw away ~92px of screen above itself for nothing.
 *
 * Three changes, in order of how much they matter:
 *
 * 1. FULL HEIGHT. The list is the only part that flexes; everything else is
 *    fixed furniture, so the fix is to stop capping the container. Coming from
 *    the right rather than the bottom is what makes full height natural — a
 *    sheet that occupies the whole screen is not a sheet.
 *
 * 2. A SMALLER FOOTER. The meter moved to the top, under the header, where it
 *    belongs anyway: it is a nudge about the items, not part of the total, and
 *    up there it scrolls out of the way instead of taxing the list forever.
 *    The footer keeps the coupon toggle, the total and Checkout. Subtotal and
 *    the delivery line are gone from the drawer — the meter above already says
 *    whether delivery is free, and the full breakdown is a tap away on the
 *    cart page and unavoidable at checkout.
 *
 * 3. AN OPAQUE PANEL. `.glass-strong` is ~10% transparent; the page behind it
 *    was legible through the totals. See `.panel-solid` in globals.css.
 *
 * Together the list goes from ~340px to ~500px on the same phone, and — the
 * part that actually matters — it holds at five items or twenty, because the
 * list is now the part that absorbs the difference.
 */
export function CartDrawer() {
  const open = useUI((s) => s.cartOpen);
  const close = useUI((s) => s.closeCart);
  const lines = useCart((s) => s.lines);
  const { priced, loading } = usePricedCart();
  const reduce = useReducedMotion();
  const pathname = usePathname();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /**
   * Focus handling.
   *
   * The panel has always claimed `aria-modal="true"`, which promises that Tab
   * cannot leave it. Nothing enforced that, so a keyboard user tabbing through
   * an open cart walked straight out into the page underneath — still visible,
   * still clickable, and with no way to tell they had left. Escape closed it
   * but focus was then wherever it happened to land.
   */
  useEffect(() => {
    if (!open) return;
    const restoreTo = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      const focusable = [
        ...panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      restoreTo?.focus?.();
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

          {/* Centring frame. Tight padding on a phone, generous from `sm` up:
              every pixel of margin here is a pixel the item list does not get,
              and the list is the part people came to read. */}
          <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Your cart"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 12 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            /*
              Swipe DOWN to dismiss, on touch only.
              It used to be swipe-right, which suited a panel that entered from
              the right. A modal has no edge to throw it back to, and down is
              the gesture people already use to dismiss a sheet. `drag="y"` with
              a 0 top constraint means the list still scrolls normally and only
              a downward pull past the resting position moves the panel.
            */
            drag={isDesktop || reduce ? false : "y"}
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 550) close();
            }}
            /*
              A DEFINITE height, not a cap. This is the whole layout.

              With `max-h` and auto height the panel has no height for flex to
              distribute, so `flex-1` on the list resolves against nothing: give
              the list a `h-full` child and the list overflows and the footer
              paints over it; make that child absolute and the list collapses to
              zero and the items vanish entirely. Both were shipped and both
              looked like different bugs.

              A real height fixes both at once — flex can divide it, the list
              takes what the header and footer leave, and `overflow-hidden`
              keeps the corners clean. The cost is a tall box when the cart
              holds one item, which is exactly what the reference does too.
            */
            className="panel-solid relative flex h-[calc(100dvh-1.5rem)] w-full flex-col
                       overflow-hidden sm:h-[85dvh] sm:max-h-[46rem] sm:w-[min(34rem,100%)]"
          >
            <header className="flex shrink-0 items-center justify-between gap-4 px-5 py-4 sm:px-6">
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
                data-autofocus
                // 44px target: this is the primary way out on a phone.
                className="-mr-2 flex h-11 w-11 items-center justify-center text-stone transition-colors hover:text-bone"
              >
                <X className="h-5 w-5" strokeWidth={1.4} />
              </button>
            </header>

            {isEmpty ? (
              <>
                <div className="rule" />
                <EmptyCart onClose={close} />
              </>
            ) : (
              <>
                {/*
                  The meter, at the top. It reports whether delivery is free,
                  which is why the footer no longer needs a delivery line.
                */}
                <FreeShippingMeter priced={priced} variant="strip" />

                {/*
                  Column headers, as the reference has them. They are labels for
                  the list below, so they sit outside the scroller — scrolling a
                  header out of view is how a table stops being readable halfway
                  down. aria-hidden because the rows below are a list, not a
                  table: a screen reader gets the product name and price from
                  each row, and announcing "product, total" first would be two
                  words of furniture before every cart.
                */}
                <div
                  aria-hidden="true"
                  className="flex shrink-0 items-baseline justify-between border-b border-line
                             px-5 pb-2.5 pt-3.5 font-sans text-[0.625rem] uppercase
                             tracking-label text-stone-dark sm:px-6"
                >
                  <span>Product</span>
                  <span>Total</span>
                </div>

                <CartLines priced={priced} loading={loading} onNavigate={close} />

                {/*
                  Every row here is height the list does not get, so each one
                  has to earn it. "View full cart" is a link beside the total
                  rather than a line of its own, and the tax note is one line
                  instead of two — between them that is ~50px, which is most of
                  another product.
                */}
                <footer
                  className="shrink-0 space-y-3 border-t border-line px-5 pt-3.5 sm:px-6"
                  // Clear of the iOS home indicator without stranding the
                  // button halfway up the panel on everything else.
                  style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
                >
                  {/*
                    No coupon field here, deliberately.

                    It is the one row in this footer that asks the customer to
                    stop and do something, at the exact moment they have decided
                    to buy — and it costs the item list height on every cart,
                    including the overwhelming majority that never use a code.
                    The field still exists in both places it belongs: on /cart,
                    one tap away via View cart, and on the checkout form itself,
                    where it is unmissable.
                  */}
                  <CartSummary priced={priced} loading={loading} compact />

                  {/*
                    Two doors, side by side: straight to payment, or the full
                    cart page to review first. They share one row so the footer
                    costs the item list no more height than the single button
                    did — the note above about every row having to earn its
                    space still applies.

                    "View cart" also replaces the "See full breakdown" link that
                    used to sit beside the total; the same destination twice in
                    one footer is a row the list was paying for.
                  */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <Link href="/checkout" className="btn btn-primary btn-lg">
                      Checkout
                      <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
                    </Link>
                    <Link href="/cart" className="btn btn-outline btn-lg">
                      View cart
                    </Link>
                  </div>
                </footer>
              </>
            )}
          </motion.aside>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * The scrolling half of the drawer.
 *
 * `min-h-0` on a flex child is the whole trick: without it a flex item refuses
 * to shrink below its content, so `flex-1` plus `overflow-y-auto` silently
 * does nothing and the panel grows instead of the list scrolling.
 *
 * The fade and the "more below" pill exist because the old drawer gave no
 * signal at all that the list continued. A scrollbar inside a 340px box on a
 * touch screen is invisible, which is precisely how a cart holding five things
 * managed to look like a cart holding one.
 */
function CartLines({
  priced,
  loading,
  onNavigate,
}: {
  priced: PricedCartDTO | null;
  loading: boolean;
  onNavigate: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const lineCount = priced?.lines.length ?? 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      const remaining = el.scrollHeight - el.clientHeight - el.scrollTop;
      setMore(remaining > 12);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    // The list changes height as lines are added, removed and re-priced, and
    // the panel changes height when the phone's browser chrome collapses.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [lineCount]);

  function scrollDown() {
    scrollRef.current?.scrollBy({ top: scrollRef.current.clientHeight * 0.8, behavior: "smooth" });
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain px-5 sm:px-6">
        {priced?.dropped.length ? (
          <p className="mt-5 border border-warning/40 bg-warning/[0.06] px-4 py-3 font-sans text-xs leading-relaxed text-warning">
            {priced.dropped.map((d) => d.name).join(", ")}{" "}
            {priced.dropped.length === 1 ? "is" : "are"} no longer available and{" "}
            {priced.dropped.length === 1 ? "was" : "were"} removed.
          </p>
        ) : null}

        <ul className="divide-y divide-line">
          {(priced?.lines ?? []).map((line) => (
            <CartLineRow key={line.variantId} line={line} onNavigate={onNavigate} compact />
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

        {/* Breathing room so the last row clears the fade rather than hiding under it. */}
        <div className="h-6" aria-hidden="true" />
      </div>

      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink-deep to-transparent",
          "transition-opacity duration-300",
          more ? "opacity-100" : "opacity-0",
        )}
      />

      {/*
        Small, and sitting low enough to ride the fade rather than the row
        underneath it. The first cut was a full-size pill parked over the
        middle of the next product — it announced there was more by covering
        some of it.
      */}
      <button
        type="button"
        onClick={scrollDown}
        tabIndex={more ? 0 : -1}
        aria-hidden={!more}
        className={cn(
          "absolute bottom-1 left-1/2 -translate-x-1/2 rounded-pill border border-line-strong bg-surface",
          "px-2.5 py-1 font-sans text-[0.5625rem] uppercase tracking-wide2 text-stone",
          "transition-all duration-300 hover:text-gold-light",
          more ? "opacity-100" : "pointer-events-none translate-y-1 opacity-0",
        )}
      >
        More below
        <ChevronDown className="ml-1 inline h-2.5 w-2.5" strokeWidth={1.8} />
      </button>
    </div>
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
