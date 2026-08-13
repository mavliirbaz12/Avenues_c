"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Fires the purchase conversion once, when the order page is reached with
 * ?placed=1. Guarded per order in sessionStorage so a refresh of the success
 * page doesn't double-count revenue in ads reporting.
 */
export function PurchaseEvent({
  orderNumber,
  valuePaise,
  items,
}: {
  orderNumber: string;
  valuePaise: number;
  items: { name: string; sku: string; quantity: number; pricePaise: number }[];
}) {
  useEffect(() => {
    const key = `avn-purchase-${orderNumber}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage unavailable — fire anyway rather than lose the conversion.
    }

    const value = valuePaise / 100;

    window.gtag?.("event", "purchase", {
      transaction_id: orderNumber,
      currency: "INR",
      value,
      items: items.map((i) => ({
        item_id: i.sku,
        item_name: i.name,
        quantity: i.quantity,
        price: i.pricePaise / 100,
      })),
    });

    window.fbq?.("track", "Purchase", {
      currency: "INR",
      value,
      content_type: "product",
      content_ids: items.map((i) => i.sku),
    });
  }, [orderNumber, valuePaise, items]);

  return null;
}
