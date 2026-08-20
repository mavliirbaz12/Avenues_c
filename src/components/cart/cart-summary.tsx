"use client";

import { formatPaise } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PricedCartDTO } from "@/hooks/use-priced-cart";

/**
 * The money column. Shared by the drawer, the cart page and checkout so the
 * three can never disagree about how a total was reached.
 */
export function CartSummary({
  priced,
  loading,
  showCodFee = false,
  compact = false,
  aside,
  className,
}: {
  priced: PricedCartDTO | null;
  loading: boolean;
  showCodFee?: boolean;
  /**
   * Total only, for the cart drawer.
   *
   * The full breakdown is four rows plus a total plus two notes — around
   * 200px, which in a drawer comes straight out of the item list. Subtotal is
   * the total minus a discount the drawer already names, and the delivery line
   * repeats what the free-shipping meter says at the top of the panel. Neither
   * earns its height there. The cart page and checkout keep every row.
   */
  compact?: boolean;
  /** Rendered under the "Total" label in compact mode — the drawer puts its
   *  link to the full cart page there rather than spending a whole row on it. */
  aside?: React.ReactNode;
  className?: string;
}) {
  if (!priced) {
    return (
      <div className={cn("space-y-3", className)} aria-hidden="true">
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-2/3" />
      </div>
    );
  }

  const savedPaise = priced.mrpTotalPaise - priced.subtotalPaise + priced.discountPaise;

  if (compact) {
    return (
      <div className={cn("font-sans", className)} aria-busy={loading}>
        {/*
          Two labelled rows and a note — the shape the reference cart uses, and
          the shape asked for here.

          "Cart total" and "Subtotal" carry the same figure, and that is not a
          slip: delivery is not known until an address is entered, which is what
          the note underneath says. They diverge the moment a coupon applies,
          and the discount row above names it.
        */}
        <dl className="space-y-1.5">
          {priced.discountPaise > 0 && priced.coupon.status === "applied" && (
            <Row label={`Discount (${priced.coupon.code})`} tone="gold">
              &minus;{formatPaise(priced.discountPaise)}
            </Row>
          )}
          <Row label="Cart total">{formatPaise(priced.subtotalPaise)}</Row>
          <Row label="Subtotal">{formatPaise(priced.totalPaise)}</Row>
        </dl>

        {/* Kept, though the reference has no equivalent: this store discounts
            hard enough that the saving is worth naming. */}
        {savedPaise > 0 && (
          <p className="mt-2 text-right font-sans text-xs text-gold">
            You save {formatPaise(savedPaise)}
          </p>
        )}

        <p className="mt-2.5 font-sans text-[0.6875rem] leading-relaxed text-stone-dark">
          Inclusive of all taxes. Delivery calculated at checkout.
        </p>
        {aside}
      </div>
    );
  }

  return (
    <div className={cn("font-sans", className)} aria-busy={loading}>
      <dl className="space-y-3">
        <Row label={`Subtotal (${priced.itemCount} item${priced.itemCount === 1 ? "" : "s"})`}>
          {formatPaise(priced.subtotalPaise)}
        </Row>

        {priced.discountPaise > 0 && priced.coupon.status === "applied" && (
          <Row label={`Discount (${priced.coupon.code})`} tone="gold">
            &minus;{formatPaise(priced.discountPaise)}
          </Row>
        )}

        <Row label="Delivery">
          {priced.shippingPaise === 0 ? (
            <span className="text-gold-light">Free</span>
          ) : (
            formatPaise(priced.shippingPaise)
          )}
        </Row>

        {showCodFee && priced.codFeePaise > 0 && (
          <Row label="Cash on delivery fee">{formatPaise(priced.codFeePaise)}</Row>
        )}
      </dl>

      <div className="mt-5 flex items-baseline justify-between border-t border-line pt-5">
        <span className="font-sans text-micro uppercase text-stone">Total</span>
        <span className="font-display text-3xl font-light text-bone">
          {formatPaise(priced.totalPaise)}
        </span>
      </div>

      {savedPaise > 0 && (
        <p className="mt-2 text-right font-sans text-xs text-gold">
          You save {formatPaise(savedPaise)}
        </p>
      )}

      <p className="mt-3 font-sans text-xs leading-relaxed text-stone-dark">
        Inclusive of all taxes. Delivery calculated at checkout for your pincode.
      </p>
    </div>
  );
}

/**
 * Progress toward free delivery — a real nudge, not a fake urgency banner.
 *
 * `strip` is the drawer's version: flush to the panel edges, under the header,
 * where it reads as a status line about the cart rather than a card floating
 * in the money column. It sits above the item list on purpose — it is the one
 * piece of the old footer worth keeping in view, and up there it costs the
 * list nothing that a bordered box in the footer did not cost it twice over.
 */
export function FreeShippingMeter({
  priced,
  variant = "panel",
}: {
  priced: PricedCartDTO | null;
  variant?: "panel" | "strip";
}) {
  if (!priced || priced.itemCount === 0) return null;

  const earned = priced.toFreeShippingPaise <= 0;
  const goal = priced.freeShippingThresholdPaise;
  const progress = earned ? 1 : Math.min(1, (goal - priced.toFreeShippingPaise) / goal);

  return (
    <div
      className={cn(
        variant === "strip"
          ? "shrink-0 border-b border-line bg-surface/40 px-5 py-4 text-center sm:px-6"
          : "border border-line bg-surface/60 px-4 py-3.5",
      )}
    >
      {/*
        Earning it is an ANNOUNCEMENT; not earning it yet is an instruction.
        The two want different weight, so the strip states the win in the
        brand's own voice — gold, spaced caps — and otherwise just says the
        number to beat. Centred in the strip because it now heads the modal.
      */}
      <p
        className={cn(
          "font-sans leading-relaxed",
          variant === "strip"
            ? "text-[0.6875rem] uppercase tracking-label"
            : "text-xs",
          earned ? "text-gold-light" : "text-stone",
        )}
      >
        {earned ? (
          <>Delivery is on us{variant === "strip" ? " — you have earned free shipping" : ""}.</>
        ) : (
          <>Add {formatPaise(priced.toFreeShippingPaise)} more for free delivery.</>
        )}
      </p>
      <div
        className={cn("h-px w-full bg-line-strong", variant === "strip" ? "mt-3" : "mt-2.5")}
        role="presentation"
      >
        <div
          className="h-px bg-gold transition-[width] duration-900 ease-smoke"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  );
}

function Row({
  label,
  children,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  tone?: "gold";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-stone">{label}</dt>
      <dd className={cn("text-sm tabular-nums", tone === "gold" ? "text-gold" : "text-bone")}>
        {children}
      </dd>
    </div>
  );
}
