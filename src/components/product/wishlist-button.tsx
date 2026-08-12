"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useWishlist } from "@/store/wishlist";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

/**
 * Heart toggle. Appears anywhere a product does.
 *
 * Reads `mounted` before reflecting state because the wishlist store hydrates
 * from localStorage after the first paint — rendering the filled state on the
 * server would be a lie for guests and a hydration mismatch for everyone.
 */
export function WishlistButton({
  productId,
  productName,
  className,
  size = "md",
  showLabel = false,
}: {
  productId: string;
  productName: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const ids = useWishlist((s) => s.ids);
  const toggle = useWishlist((s) => s.toggle);
  const toast = useUI((s) => s.toast);

  useEffect(() => setMounted(true), []);

  const saved = mounted && ids.includes(productId);

  const dims = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  }[size];

  const icon = {
    sm: "h-3.5 w-3.5",
    md: "h-[1.05rem] w-[1.05rem]",
    lg: "h-5 w-5",
  }[size];

  async function onClick(e: React.MouseEvent) {
    // The button often sits inside a card-wide <Link>.
    e.preventDefault();
    e.stopPropagation();

    const nowSaved = toggle(productId);
    toast({
      title: nowSaved ? `${productName} saved` : `${productName} removed`,
      description: nowSaved ? "Find it in your wishlist." : undefined,
    });

    // Mirror to the database for signed-in users. Guests keep it local until
    // they log in, at which point the local set is merged upward.
    try {
      await fetch("/api/wishlist", {
        method: nowSaved ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
    } catch {
      // Offline or signed out — localStorage is already the source of truth.
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`}
      className={cn(
        "inline-flex items-center justify-center gap-2 border transition-all duration-400 ease-smoke",
        showLabel ? "h-12 px-5" : dims,
        saved
          ? "border-gold/50 text-gold"
          : "border-line text-stone hover:border-gold/40 hover:text-gold-light",
        className,
      )}
    >
      <Heart
        className={cn(icon, "transition-[fill] duration-400")}
        strokeWidth={1.4}
        fill={saved ? "currentColor" : "none"}
      />
      {showLabel && (
        <span className="font-sans text-micro uppercase">{saved ? "Saved" : "Save"}</span>
      )}
    </button>
  );
}
