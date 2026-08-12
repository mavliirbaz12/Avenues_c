"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCart } from "@/store/cart";
import type { PricedLine, DroppedLine, CouponOutcome } from "@/lib/commerce/pricing";

export type PricedCartDTO = {
  lines: PricedLine[];
  dropped: DroppedLine[];
  itemCount: number;
  subtotalPaise: number;
  mrpTotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  codFeePaise: number;
  totalPaise: number;
  coupon: CouponOutcome;
  freeShippingThresholdPaise: number;
  toFreeShippingPaise: number;
  codEnabled: boolean;
  codFeeIfChosenPaise: number;
};

/**
 * Keeps a server-priced view of the local cart.
 *
 * The component tree renders *this* — never arithmetic done in the browser —
 * so what a customer sees is always what the server would charge. Requests are
 * debounced (quantity steppers fire fast) and aborted on supersede so a slow
 * earlier response can't overwrite a newer one.
 */
export function usePricedCart(paymentMethod?: "RAZORPAY" | "COD" | null) {
  const lines = useCart((s) => s.lines);
  const couponCode = useCart((s) => s.couponCode);

  const [data, setData] = useState<PricedCartDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Stable dependency: re-price when contents change, not on every render.
  const signature = lines.map((l) => `${l.variantId}:${l.quantity}`).join("|");

  const refresh = useCallback(async () => {
    abortRef.current?.abort();

    if (lines.length === 0) {
      setData(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      const res = await fetch("/api/cart/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
          couponCode: couponCode ?? null,
          paymentMethod: paymentMethod ?? null,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as PricedCartDTO);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("[cart] pricing failed:", err);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, couponCode, paymentMethod]);

  useEffect(() => {
    const t = setTimeout(refresh, 180);
    return () => clearTimeout(t);
  }, [refresh]);

  return { priced: data, loading, refresh };
}
