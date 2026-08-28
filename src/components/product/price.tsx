import { formatPaise, discountPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Money, rendered the same way everywhere.
 *
 * Six surfaces used to draw a price and no two agreed. The scale differing by
 * context is correct — a PDP price should dominate and a cart line should not —
 * but everything else had drifted:
 *
 *   - the cart set money in `font-sans` while every other surface used the
 *     display face, so the same ₹499 changed typeface between the shelf and
 *     the basket;
 *   - `tabular-nums` appeared only in the cart, so figures under a quantity
 *     stepper were the only ones that did not jitter as they changed;
 *   - the "% off" badge existed only on the PDP, while `product-card.tsx`
 *     computed the percentage into a variable it never rendered;
 *   - `leading-none` was applied on two surfaces and not the other four.
 *
 * So this owns the treatment and callers choose only the scale. Adding a badge
 * or changing the strikethrough is now one edit rather than six, and the two
 * inline re-implementations of the discount maths are gone — `discountPercent`
 * is the only copy.
 */

export type PriceSize = "sm" | "md" | "lg" | "xl";

const SCALE: Record<PriceSize, { price: string; mrp: string; gap: string; badge: string }> = {
  /** Cart lines, order summaries — beside a quantity stepper. */
  sm: { price: "text-sm", mrp: "text-xs", gap: "gap-x-2 gap-y-0.5", badge: "text-[0.5625rem] px-1.5 py-0.5" },
  /** Product cards and rails. */
  md: { price: "text-2xl", mrp: "text-sm", gap: "gap-x-2.5 gap-y-1", badge: "text-[0.625rem] px-2 py-0.5" },
  /** Feature bands. */
  lg: { price: "text-3xl", mrp: "text-base", gap: "gap-x-3 gap-y-1", badge: "text-[0.625rem] px-2.5 py-1" },
  /** The buy box, and the set page's hero. */
  xl: { price: "text-4xl", mrp: "text-lg", gap: "gap-x-4 gap-y-2", badge: "text-[0.625rem] px-2.5 py-1" },
};

export function Price({
  pricePaise,
  mrpPaise,
  size = "md",
  badge,
  prefix,
  className,
}: {
  pricePaise: number;
  /** Omit, or pass a value at or below the price, to render no strikethrough. */
  mrpPaise?: number | null;
  size?: PriceSize;
  /**
   * Show the "N% off" chip. Defaults on wherever there is room — off at `sm`,
   * where a cart row is already carrying a stepper and a remove control.
   */
  badge?: boolean;
  /** e.g. a "From" label on a card for a product with several sizes. */
  prefix?: React.ReactNode;
  className?: string;
}) {
  const s = SCALE[size];
  const discounted = typeof mrpPaise === "number" && mrpPaise > pricePaise;
  const off = discounted ? discountPercent(mrpPaise, pricePaise) : 0;
  const showBadge = (badge ?? size !== "sm") && off > 0;

  return (
    <span className={cn("flex flex-wrap items-baseline", s.gap, className)}>
      {prefix}
      <span
        className={cn(
          "font-display font-light tabular-nums text-bone",
          s.price,
          // After the size, deliberately. Tailwind's text-* utilities set a
          // line-height as well as a font-size, so twMerge drops an earlier
          // leading-* as a conflict — putting it last is what makes it stick.
          "leading-none",
        )}
      >
        {formatPaise(pricePaise)}
      </span>

      {discounted && (
        <span className={cn("font-sans tabular-nums text-stone-dark line-through", s.mrp)}>
          {formatPaise(mrpPaise)}
        </span>
      )}

      {showBadge && <DiscountChip percent={off} className={s.badge} />}
    </span>
  );
}

/**
 * The "N% off" chip.
 *
 * Also used on its own, positioned over a product image, by the card, the
 * combo band and the sets hero. Those three had written it out by hand and had
 * already drifted — two carried `px-3 py-1.5` and one `px-2.5 py-1` — which is
 * the kind of difference nobody notices in isolation and everybody notices when
 * two of them sit on the same screen.
 *
 * Renders nothing at zero, so callers need no guard of their own.
 */
export function DiscountChip({
  percent,
  className,
}: {
  percent: number;
  className?: string;
}) {
  if (percent <= 0) return null;
  return (
    <span
      className={cn(
        "bg-bordeaux px-2.5 py-1 font-sans text-[0.625rem] uppercase tracking-label text-bone",
        className,
      )}
    >
      {percent}% off
    </span>
  );
}
