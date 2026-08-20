"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { useUI } from "@/store/ui";
import { Sparkle } from "@/components/brand/sparkle";
import { cn } from "@/lib/utils";

/**
 * House toast. Dark glass, gold hairline, no icons beyond the brand star —
 * deliberately not a coloured notification chip.
 */
export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);
  const cartOpen = useUI((s) => s.cartOpen);
  const reduce = useReducedMotion();

  /*
    Nothing while the cart is open.

    Toasts sit at z-70 and the cart panel at z-65, so "Night Drip added · 1 in
    your cart" floated over the Checkout button — covering the primary action
    in order to describe something the open panel was already showing in full.
    Reachable in one ordinary sequence: add to cart, then tap the cart inside
    the toast's four seconds.

    Suppressing rather than repositioning is deliberate. On a phone the panel
    is the full width of the screen, so there is no free corner to move to; and
    a toast is a summary of the cart, which is the one thing the customer no
    longer needs summarised. The queue keeps draining on its own timers, so
    nothing piles up waiting to reappear.
  */
  if (cartOpen) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      style={{ paddingBottom: "calc(1rem + var(--sticky-bar-h, 0px))" }}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "glass pointer-events-auto flex w-full max-w-sm items-start gap-3 px-4 py-3.5",
              t.tone === "danger" && "border-danger/40",
              t.tone === "success" && "border-gold/35",
            )}
            role="status"
          >
            <Sparkle
              className={cn(
                "mt-1 h-2.5 w-2.5 shrink-0",
                t.tone === "danger" ? "text-danger" : "text-gold",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="font-sans text-sm leading-snug text-bone">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 font-sans text-xs leading-relaxed text-stone">
                  {t.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="-mr-1 -mt-1 shrink-0 p-1 text-stone transition-colors hover:text-bone"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
