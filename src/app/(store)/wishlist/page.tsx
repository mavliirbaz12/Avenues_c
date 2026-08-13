"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { GoldArc } from "@/components/brand/gold-arc";
import { Sparkle } from "@/components/brand/sparkle";
import { useWishlist } from "@/store/wishlist";
import type { ProductCard as Card } from "@/lib/catalog";

/**
 * Wishlist page.
 *
 * Client-rendered because a guest's wishlist lives in localStorage. The ids
 * are resolved to full product cards through /api/wishlist/resolve so guests
 * and signed-in users render through the identical path — the only difference
 * between them is where the id list came from.
 */
export default function WishlistPage() {
  const ids = useWishlist((s) => s.ids);
  const [cards, setCards] = useState<Card[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (ids.length === 0) {
      setCards([]);
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/wishlist/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: ids }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (!cancelled) setCards(data.products ?? []);
      } catch {
        if (!cancelled) setCards([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ids]);

  return (
    <div className="shell py-14 sm:py-20">
      <header className="text-center">
        <p className="micro-label-gold">Saved for later</p>
        <h1 className="mt-5 font-display text-d2 font-light text-bone">Your wishlist</h1>
        <GoldArc className="mt-8" />
      </header>

      {cards === null ? (
        <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-4">
              <div className="skeleton aspect-[4/5] w-full" />
              <div className="skeleton h-5 w-32" />
              <div className="skeleton h-4 w-20" />
            </div>
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="py-16 text-center sm:py-24">
          <span className="relative mx-auto inline-flex">
            <Heart className="h-8 w-8 text-stone-dark" strokeWidth={1} />
            <Sparkle className="absolute -right-2 -top-1 h-2.5 w-2.5 text-gold/60" />
          </span>
          <h2 className="mt-7 font-display text-d4 font-light text-bone">
            Nothing saved yet
          </h2>
          <p className="mx-auto mt-4 max-w-md font-sans text-body-lg leading-relaxed text-stone">
            Tap the heart on any fragrance and it will wait for you here —
            through sign-ins, new phones and second thoughts.
          </p>
          <Link href="/shop" className="btn btn-outline btn-lg mt-9">
            Browse the five
          </Link>
        </div>
      ) : (
        <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 3} />
          ))}
        </div>
      )}
    </div>
  );
}
