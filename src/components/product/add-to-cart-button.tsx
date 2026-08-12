"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, type CartLine } from "@/store/cart";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

/**
 * Adds a variant to the cart and opens the drawer.
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
  /** Skip the drawer and go straight to checkout. */
  buyNow?: boolean;
  onAdded?: () => void;
}) {
  const add = useCart((s) => s.add);
  const openCart = useUI((s) => s.openCart);
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
      openCart();
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
