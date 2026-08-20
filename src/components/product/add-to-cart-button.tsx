"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, type CartLine } from "@/store/cart";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

/**
 * Adds a variant to the cart.
 *
 * It does NOT open the drawer. Adding used to throw the cart over the page,
 * which takes the shopper off whatever they were reading and makes them
 * dismiss a panel before they can carry on — the same two taps they would
 * otherwise spend on "Continue shopping" or the close button. On a phone,
 * where the drawer is a full-height sheet, it reads as an interruption rather
 * than a confirmation.
 *
 * The confirmation is the bar instead: the count on the cart icon goes up, and
 * a toast names what landed. Both are visible without covering anything, and
 * the cart is one tap away for anyone who wants to look. Checkout still has
 * its own direct route — see `buyNow`.
 *
 * The line data passed here is display-only; checkout recomputes every figure
 * from the database. See src/store/cart.ts.
 */
export function AddToCartButton({
  line,
  quantity = 1,
  className,
  children,
  disabled,
  buyNow = false,
  onAdded,
}: {
  line: Omit<CartLine, "quantity"> | null;
  quantity?: number;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  /** Skip the cart entirely and go straight to checkout. */
  buyNow?: boolean;
  onAdded?: () => void;
}) {
  const add = useCart((s) => s.add);
  const toast = useUI((s) => s.toast);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const soldOut = !line || line.maxStock <= 0;

  function onClick() {
    if (!line || soldOut || busy) return;
    setBusy(true);
    add(line, quantity);
    onAdded?.();

    if (buyNow) {
      router.push("/checkout");
    } else {
      toast({ title: `${line.name} added`, description: `${line.size} · ${quantity} in your cart` });
    }
    // Brief lock so a double-tap on mobile doesn't add twice.
    setTimeout(() => setBusy(false), 450);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || soldOut || busy}
      className={cn("btn", className)}
    >
      {children ?? (soldOut ? "Sold out" : buyNow ? "Buy now" : "Add to cart")}
    </button>
  );
}
