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
  className,
}: {
  priced: PricedCartDTO | null;
  loading: boolean;
  showCodFee?: boolean;
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

/** Progress toward free delivery — a real nudge, not a fake urgency banner. */
export function FreeShippingMeter({ priced }: { priced: PricedCartDTO | null }) {
  if (!priced || priced.itemCount === 0) return null;

  const earned = priced.toFreeShippingPaise <= 0;
  const goal = priced.freeShippingThresholdPaise;
  const progress = earned ? 1 : Math.min(1, (goal - priced.toFreeShippingPaise) / goal);

  return (
    <div className="border border-line bg-surface/60 px-4 py-3.5">
      <p className="font-sans text-xs leading-relaxed text-stone">
        {earned ? (
          <span className="text-gold-light">Delivery is on us.</span>
        ) : (
          <>
            Add {formatPaise(priced.toFreeShippingPaise)} more for free delivery.
          </>
        )}
      </p>
      <div className="mt-2.5 h-px w-full bg-line-strong" role="presentation">
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
