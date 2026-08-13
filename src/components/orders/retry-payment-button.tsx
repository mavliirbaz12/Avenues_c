"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRazorpay } from "@/hooks/use-razorpay";
import { cn } from "@/lib/utils";

/** "Pay now" for a PENDING prepaid order whose payment failed or was abandoned. */
export function RetryPaymentButton({
  orderId,
  accessToken,
  prefill,
  className,
}: {
  orderId: string;
  accessToken: string | null;
  prefill: { name?: string; email?: string; contact?: string };
  className?: string;
}) {
  const { launch } = useRazorpay();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function retry() {
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/checkout/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, accessToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "This order can't be paid right now.");
        setBusy(false);
        return;
      }

      await launch(
        {
          orderId: data.orderId,
          orderNumber: data.orderNumber,
          accessToken: data.accessToken,
          razorpayOrderId: data.payment.razorpayOrderId,
          keyId: data.payment.keyId,
          amountPaise: data.payment.amountPaise,
          mock: data.payment.mock,
          prefill,
        },
        {
          onError: (message) => {
            setError(message);
            setBusy(false);
          },
          onDismiss: () => setBusy(false),
        },
      );
    } catch {
      setError("Something went wrong. Try again in a moment.");
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={retry}
        disabled={busy}
        className={cn("btn btn-primary btn-lg w-full sm:w-auto")}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin-slow" strokeWidth={1.6} />}
        Complete payment
      </button>
      {error && (
        <p className="mt-3 font-sans text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
