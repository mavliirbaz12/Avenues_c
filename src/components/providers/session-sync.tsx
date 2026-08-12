"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";

/**
 * Merges the guest cart and wishlist into the signed-in account, once.
 *
 * Runs after StoreHydrator has rehydrated localStorage, sends whatever the
 * guest accumulated, and adopts the server's canonical answer. Guarded by a
 * ref so it fires once per mount rather than on every navigation — the merge
 * is idempotent, but re-running it on each page load is wasted work.
 */
export function SessionSync({ isAuthed }: { isAuthed: boolean }) {
  const done = useRef(false);

  useEffect(() => {
    if (!isAuthed || done.current) return;
    done.current = true;

    // One tick after mount so the persisted stores have rehydrated first;
    // syncing before that would upload an empty cart and wipe the guest's.
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cart: useCart
              .getState()
              .lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
            wishlist: useWishlist.getState().ids,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        useCart.getState().replaceAll(data.cart ?? []);
        useWishlist.getState().replaceAll(data.wishlist ?? []);
      } catch {
        // Offline — the local copies remain authoritative until next load.
      }
    }, 120);

    return () => clearTimeout(t);
  }, [isAuthed]);

  return null;
}
