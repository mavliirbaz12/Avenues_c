"use client";

import { useEffect } from "react";
import { useCart } from "@/store/cart";

/**
 * Dropped onto the order page when it is reached with ?placed=1 — the moment
 * an order is genuinely paid/placed, the local cart it came from is emptied.
 * Doing it here (rather than optimistically before the gateway) means an
 * abandoned payment leaves the customer's cart intact.
 */
export function ClearCartOnArrival() {
  const clear = useCart((s) => s.clear);

  useEffect(() => {
    clear();
  }, [clear]);

  return null;
}
