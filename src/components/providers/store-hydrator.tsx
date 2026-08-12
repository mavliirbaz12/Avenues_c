"use client";

import { useEffect } from "react";
import { useCart } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";

/**
 * Both persisted stores are created with `skipHydration`, so the server and
 * the first client render agree on an empty cart. This component rehydrates
 * them from localStorage immediately after mount — after which counts and
 * badges appear.
 *
 * Without this, a guest with three items in the cart would produce a React
 * hydration mismatch on every page load.
 */
export function StoreHydrator() {
  useEffect(() => {
    void useCart.persist.rehydrate();
    void useWishlist.persist.rehydrate();
  }, []);

  return null;
}
