"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Client cart.
 *
 * IMPORTANT: the prices carried here are for DISPLAY ONLY. The server treats
 * an incoming cart as nothing more than a list of (variantId, quantity)
 * intents and recomputes every figure from the database at checkout. Nothing
 * in this file can influence what a customer is charged.
 *
 * Guests persist to localStorage. On login the guest cart is merged into the
 * signed-in user's database cart (see mergeGuestCart in src/lib/cart.ts) and
 * the local copy is replaced by the server's canonical version.
 */

export type CartLine = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  size: string;
  sku: string;
  pricePaise: number;
  mrpPaise: number;
  imageUrl: string | null;
  /** Snapshot of available stock, used to clamp the quantity stepper. */
  maxStock: number;
  quantity: number;
};

type CartState = {
  lines: CartLine[];
  /** The code the customer typed. Validity is decided by the server on every
   *  price call — this is an intent, not an entitlement. */
  couponCode: string | null;
  add: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  setCoupon: (code: string | null) => void;
  /** Replaces the whole cart — used after a server sync or merge. */
  replaceAll: (lines: CartLine[]) => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      couponCode: null,

      add: (line, quantity = 1) =>
        set((state) => {
          const existing = state.lines.find((l) => l.variantId === line.variantId);
          if (existing) {
            const next = Math.min(existing.quantity + quantity, Math.max(line.maxStock, 1));
            return {
              lines: state.lines.map((l) =>
                l.variantId === line.variantId ? { ...l, ...line, quantity: next } : l,
              ),
            };
          }
          return {
            lines: [
              ...state.lines,
              { ...line, quantity: Math.min(quantity, Math.max(line.maxStock, 1)) },
            ],
          };
        }),

      setQuantity: (variantId, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.variantId !== variantId)
              : state.lines.map((l) =>
                  l.variantId === variantId
                    ? { ...l, quantity: Math.min(quantity, Math.max(l.maxStock, 1)) }
                    : l,
                ),
        })),

      remove: (variantId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.variantId !== variantId) })),

      clear: () => set({ lines: [], couponCode: null }),

      setCoupon: (code) => set({ couponCode: code ? code.trim().toUpperCase() : null }),

      replaceAll: (lines) => set({ lines }),
    }),
    {
      name: "avenues-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Hydration is deferred to <StoreHydrator/> on the client. Without this
      // the server renders an empty cart and the client renders a full one,
      // which React reports as a hydration mismatch.
      skipHydration: true,
    },
  ),
);

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);

export const cartSubtotalPaise = (lines: CartLine[]) =>
  lines.reduce((n, l) => n + l.pricePaise * l.quantity, 0);

export const cartMrpTotalPaise = (lines: CartLine[]) =>
  lines.reduce((n, l) => n + l.mrpPaise * l.quantity, 0);
