"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldAlert, Check, X, Loader2 } from "lucide-react";
import { Monogram } from "@/components/brand/monogram";
import { useCart } from "@/store/cart";
import { formatPaise } from "@/lib/format";
import { MOCK_PAYMENT_PREFIX, MOCK_SIGNATURE } from "@/lib/payments/razorpay";

/**
 * The mock payment gateway.
 *
 * Stands in for Razorpay Checkout while no keys are configured. Deliberately
 * looks like an internal tool — amber banner, plain buttons — so nobody could
 * mistake it for a real payment screen. Success drives the exact same
 * /api/payments/verify path the real gateway uses.
 */
function MockPayInner() {
  const router = useRouter();
  const params = useSearchParams();
  const clearCart = useCart((s) => s.clear);

  const razorpayOrderId = params.get("o") ?? "";
  const orderNumber = params.get("n") ?? "";
  const accessToken = params.get("t") ?? "";
  const amountPaise = Number(params.get("amt") ?? 0);

  const [busy, setBusy] = useState<"success" | "failure" | null>(null);
  const [error, setError] = useState("");

  async function simulateSuccess() {
    setBusy("success");
    setError("");
    try {
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpayOrderId,
          razorpayPaymentId: `${MOCK_PAYMENT_PREFIX}${Date.now().toString(36)}`,
          signature: MOCK_SIGNATURE,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      clearCart();
      router.push(`/order/${data.orderNumber}?t=${data.accessToken}&placed=1`);
    } catch {
      setError("Verification failed — check the server logs.");
      setBusy(null);
    }
  }

  async function simulateFailure() {
    setBusy("failure");
    setError("");
    try {
      await fetch("/api/payments/mock-fail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razorpayOrderId }),
      });
    } finally {
      router.push(`/order/${orderNumber}?t=${accessToken}&failed=1`);
    }
  }

  if (!razorpayOrderId || !orderNumber) {
    return (
      <div className="shell py-24 text-center">
        <p className="font-sans text-stone">This page only works as part of a checkout.</p>
      </div>
    );
  }

  return (
    <div className="shell flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <div
          className="mb-6 flex items-start gap-3 border border-warning/50 bg-warning/[0.08] px-4 py-3.5"
          role="note"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.6} />
          <p className="font-sans text-xs leading-relaxed text-warning">
            Mock payment mode. No Razorpay keys are configured, so this simulator
            stands in for the real gateway. Nothing is charged anywhere.
          </p>
        </div>

        <div className="card p-8 text-center">
          <Monogram className="mx-auto h-10 w-10" />
          <p className="micro-label mt-6">Order {orderNumber}</p>
          <p className="mt-3 font-display text-5xl font-light text-bone">
            {formatPaise(amountPaise)}
          </p>

          <div className="mt-9 space-y-3">
            <button
              type="button"
              onClick={simulateSuccess}
              disabled={busy !== null}
              className="btn btn-primary btn-lg w-full"
            >
              {busy === "success" ? (
                <Loader2 className="h-4 w-4 animate-spin-slow" strokeWidth={1.6} />
              ) : (
                <Check className="h-4 w-4" strokeWidth={1.8} />
              )}
              Simulate successful payment
            </button>
            <button
              type="button"
              onClick={simulateFailure}
              disabled={busy !== null}
              className="btn btn-danger btn-md w-full"
            >
              {busy === "failure" ? (
                <Loader2 className="h-4 w-4 animate-spin-slow" strokeWidth={1.6} />
              ) : (
                <X className="h-4 w-4" strokeWidth={1.8} />
              )}
              Simulate failed payment
            </button>
          </div>

          {error && (
            <p className="mt-5 font-sans text-xs text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MockPayPage() {
  return (
    <Suspense fallback={null}>
      <MockPayInner />
    </Suspense>
  );
}
