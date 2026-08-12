"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Wishlist — product IDs only; the storefront resolves them to products.
 *
 * Guests persist to localStorage; signed-in users are mirrored to the
 * WishlistItem table. On login the local set is merged upward and then
 * replaced by the server's copy.
 */

type WishlistState = {
  ids: string[];
  toggle: (productId: string) => boolean; // returns the new membership state
  add: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
  replaceAll: (ids: string[]) => void;
};

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],

      toggle: (productId) => {
        const has = get().ids.includes(productId);
        set((s) => ({
          ids: has ? s.ids.filter((id) => id !== productId) : [...s.ids, productId],
        }));
        return !has;
      },

      add: (productId) =>
        set((s) => (s.ids.includes(productId) ? s : { ids: [...s.ids, productId] })),

      remove: (productId) => set((s) => ({ ids: s.ids.filter((id) => id !== productId) })),

      clear: () => set({ ids: [] }),

      replaceAll: (ids) => set({ ids }),
    }),
    {
      name: "avenues-wishlist",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
