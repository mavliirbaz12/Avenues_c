"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  customerCancelOrder,
  requestReturn,
  ORDER_ACTION_IDLE,
} from "@/app/actions/orders";
import { cn } from "@/lib/utils";

/**
 * Customer order controls: cancel before shipment, request a return after
 * delivery. Which one renders is decided by the server page; both confirm
 * with a reason field rather than a bare destructive button.
 */
export function OrderActions({
  orderId,
  accessToken,
  mode,
}: {
  orderId: string;
  accessToken: string | null;
  mode: "cancel" | "return";
}) {
  const [open, setOpen] = useState(false);
  const action = mode === "cancel" ? customerCancelOrder : requestReturn;
  const [state, formAction] = useActionState(action, ORDER_ACTION_IDLE);

  if (state.ok) {
    return (
      <p
        className="mt-8 border border-gold/25 bg-gold/[0.04] p-5 font-sans text-sm leading-relaxed text-gold-light"
        role="status"
      >
        {state.message}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "mt-8 font-sans text-micro uppercase underline-offset-4 transition-colors",
          mode === "cancel"
            ? "text-stone hover:text-danger"
            : "text-stone hover:text-gold-light",
        )}
      >
        {mode === "cancel" ? "Cancel this order" : "Request a return"}
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-8 border border-line p-5">
      <input type="hidden" name="orderId" value={orderId} />
      {accessToken && <input type="hidden" name="accessToken" value={accessToken} />}

      <p className="font-sans text-sm text-bone">
        {mode === "cancel" ? "Cancel this order?" : "Request a return"}
      </p>
      <p className="mt-1.5 font-sans text-xs leading-relaxed text-stone">
        {mode === "cancel"
          ? "If you paid online, the full amount comes back to your original payment method."
          : "Tell us what went wrong. Unopened bottles return free within seven days of delivery; if it arrived damaged, we replace it."}
      </p>

      <label htmlFor={`oa-reason-${mode}`} className="field-label mt-4">
        Reason
      </label>
      <textarea
        id={`oa-reason-${mode}`}
        name="reason"
        required
        rows={mode === "cancel" ? 2 : 4}
        placeholder={mode === "cancel" ? "Changed my mind, ordered twice…" : "What happened?"}
        className="field resize-y"
      />

      {state.message && (
        <p className="mt-3 font-sans text-xs text-danger" role="alert">
          {state.message}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <SubmitButton mode={mode} />
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">
          Never mind
        </button>
      </div>
    </form>
  );
}

function SubmitButton({ mode }: { mode: "cancel" | "return" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn("btn btn-sm", mode === "cancel" ? "btn-danger" : "btn-outline")}
    >
      {pending
        ? mode === "cancel"
          ? "Cancelling"
          : "Sending"
        : mode === "cancel"
          ? "Confirm cancellation"
          : "Send return request"}
    </button>
  );
}
