"use client";

import { useEffect, useState } from "react";
import { Check, X, Tag } from "lucide-react";
import { useCart } from "@/store/cart";
import { formatPaise } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CouponOutcome } from "@/lib/commerce/pricing";

/**
 * Coupon entry.
 *
 * Fully functional before any coupon exists — it validates against the
 * database and reports "that code isn't valid" rather than pretending to
 * work. Validity is decided entirely server-side in evaluateCoupon(); this
 * component only holds the typed intent and renders the verdict.
 */
export function CouponField({
  outcome,
  loading,
  className,
}: {
  outcome: CouponOutcome | undefined;
  loading: boolean;
  className?: string;
}) {
  const applied = useCart((s) => s.couponCode);
  const setCoupon = useCart((s) => s.setCoupon);
  const [value, setValue] = useState(applied ?? "");
  const [open, setOpen] = useState(Boolean(applied));

  // Drop a code the server rejected so it doesn't follow the customer into
  // checkout and silently fail there.
  useEffect(() => {
    if (outcome?.status === "rejected") setValue(outcome.code);
  }, [outcome]);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    setCoupon(value.trim() ? value : null);
  }

  function clear() {
    setCoupon(null);
    setValue("");
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2.5 font-sans text-micro uppercase text-stone transition-colors hover:text-gold-light",
          className,
        )}
      >
        <Tag className="h-3.5 w-3.5 text-gold/70" strokeWidth={1.4} />
        Have a coupon code?
      </button>
    );
  }

  const isApplied = outcome?.status === "applied";
  const isRejected = outcome?.status === "rejected";

  return (
    <div className={className}>
      <form onSubmit={apply} className="flex gap-2">
        <label htmlFor="coupon" className="sr-only">
          Coupon code
        </label>
        <input
          id="coupon"
          name="coupon"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder="Coupon code"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={isRejected || undefined}
          className={cn(
            "field flex-1 uppercase tracking-wide2",
            isRejected && "field-error",
            isApplied && "border-gold/50 text-gold-light",
          )}
        />
        {isApplied ? (
          <button type="button" onClick={clear} className="btn btn-ghost btn-md shrink-0">
            Remove
          </button>
        ) : (
          <button
            type="submit"
            disabled={loading || !value.trim()}
            className="btn btn-outline btn-md shrink-0"
          >
            {loading ? "Checking" : "Apply"}
          </button>
        )}
      </form>

      {isApplied && (
        <p className="mt-2.5 flex items-center gap-2 font-sans text-xs text-gold-light" role="status">
          <Check className="h-3.5 w-3.5" strokeWidth={1.8} />
          {outcome.label} applied &mdash; you save {formatPaise(outcome.discountPaise)}
        </p>
      )}

      {isRejected && (
        <p className="mt-2.5 flex items-center gap-2 font-sans text-xs text-danger" role="alert">
          <X className="h-3.5 w-3.5" strokeWidth={1.8} />
          {outcome.message}
        </p>
      )}
    </div>
  );
}
