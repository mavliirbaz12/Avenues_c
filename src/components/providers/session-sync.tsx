"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";
import { useSession } from "@/store/session";

/**
 * Merges the guest cart and wishlist into the signed-in account, once.
 *
 * Runs after StoreHydrator has rehydrated localStorage, sends whatever the
 * guest accumulated, and adopts the server's canonical answer. Guarded by a
 * ref so it fires once per mount rather than on every navigation — the merge
 * is idempotent, but re-running it on each page load is wasted work.
 *
 * ALSO the one place that kicks off the session probe. `isAuthed` used to
 * arrive as a prop from the store layout, which is exactly what forced every
 * storefront route to be dynamic; it now comes from the client session store
 * (see src/store/session.ts). The merge waits for the probe to land rather
 * than firing against an unknown state — running it while `status` is still
 * "loading" would upload a guest cart on behalf of nobody.
 */
export function SessionSync() {
  const done = useRef(false);
  const status = useSession((s) => s.status);
  const load = useSession((s) => s.load);
  const isAuthed = status === "authenticated";

  useEffect(() => {
    void load();
  }, [load]);

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
