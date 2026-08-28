"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Drives a payment attempt from the browser.
 *
 * Live keys ⇒ loads Checkout.js once and opens the Razorpay modal; on success
 * the signature is verified server-side before anything is treated as paid.
 * Mock mode ⇒ navigates to /checkout/mock-pay, an honest simulator page with
 * success and failure buttons, so the whole flow is walkable without keys.
 */

type RazorpayFailure = {
  error?: {
    description?: string;
    reason?: string;
    step?: string;
    code?: string;
  };
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: "payment.failed", handler: (res: RazorpayFailure) => void) => void;
    };
  }
}

let scriptPromise: Promise<boolean> | null = null;

function loadCheckoutJs(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve) => {
    const el = document.createElement("script");
    el.src = "https://checkout.razorpay.com/v1/checkout.js";
    el.onload = () => resolve(true);
    el.onerror = () => {
      scriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(el);
  });

  return scriptPromise;
}

export type PaymentLaunch = {
  orderId: string;
  orderNumber: string;
  accessToken: string;
  razorpayOrderId: string;
  keyId: string;
  amountPaise: number;
  mock: boolean;
  prefill: { name?: string; email?: string; contact?: string };
};

export function useRazorpay() {
  const router = useRouter();

  const launch = useCallback(
    async (
      p: PaymentLaunch,
      callbacks: { onError: (message: string) => void; onDismiss: () => void },
    ) => {
      if (p.mock) {
        const qs = new URLSearchParams({
          o: p.razorpayOrderId,
          n: p.orderNumber,
          t: p.accessToken,
          amt: String(p.amountPaise),
        });
        router.push(`/checkout/mock-pay?${qs.toString()}`);
        return;
      }

      const loaded = await loadCheckoutJs();
      if (!loaded || !window.Razorpay) {
        callbacks.onError(
          "The payment window couldn't load. Check your connection and try again — you have not been charged.",
        );
        return;
      }

      const rzp = new window.Razorpay({
        key: p.keyId,
        amount: p.amountPaise,
        currency: "INR",
        name: "Avenues",
        description: `Order ${p.orderNumber}`,
        order_id: p.razorpayOrderId,
        prefill: p.prefill,
        theme: { color: "#C9A24B", backdrop_color: "#0B0B0D" },
        modal: {
          ondismiss: callbacks.onDismiss,
        },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const res = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });
            if (!res.ok) throw new Error(String(res.status));
            const data = await res.json();
            router.push(`/order/${data.orderNumber}?t=${data.accessToken}&placed=1`);
          } catch {
            // The webhook will still confirm the order server-side; send them
            // to the order page, which reflects the true state.
            router.push(`/order/${p.orderNumber}?t=${p.accessToken}`);
          }
        },
      });

      /*
        A DECLINED CARD IS NOT A CANCELLED CHECKOUT.

        Razorpay keeps its modal open after a failure so the customer can try
        another method, and only fires `ondismiss` when they eventually close
        it. Without this listener that was the only signal we ever saw, so a
        declined card, an expired card and a failed 3-D Secure step all
        surfaced as the message for "you changed your mind" — while the actual
        reason, which Razorpay hands us in plain words, was dropped.

        The webhook records the failure server-side either way (see
        /api/webhooks/razorpay), so this is purely about telling the person in
        front of the screen something true and actionable.
      */
      rzp.on("payment.failed", (res) => {
        const reason = res?.error?.description || res?.error?.reason;
        callbacks.onError(
          reason
            ? `${reason} You have not been charged — try another method.`
            : "That payment didn't go through. You have not been charged — try another method.",
        );
      });

      rzp.open();
    },
    [router],
  );

  return { launch };
}
