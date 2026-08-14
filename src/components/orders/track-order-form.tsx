"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { trackOrder } from "@/app/actions/track";
import { ACTION_IDLE } from "@/lib/form-state";

export function TrackOrderForm({ prefillOrderNumber }: { prefillOrderNumber?: string }) {
  const [state, action] = useActionState(trackOrder, ACTION_IDLE);

  return (
    <form action={action} className="space-y-5" noValidate>
      <div>
        <label htmlFor="tr-order" className="field-label">
          Order number
        </label>
        <input
          id="tr-order"
          name="orderNumber"
          required
          defaultValue={prefillOrderNumber}
          placeholder="AVN-XXXXXX"
          autoComplete="off"
          spellCheck={false}
          className="field uppercase tracking-wide2"
        />
      </div>

      <div>
        <label htmlFor="tr-contact" className="field-label">
          Email or phone used at checkout
        </label>
        <input
          id="tr-contact"
          name="contact"
          required
          placeholder="your@email.com or 10-digit mobile"
          autoComplete="email"
          className="field"
        />
      </div>

      {state.message && (
        <p className="font-sans text-sm text-danger" role="alert">
          {state.message}
        </p>
      )}

      <Submit />

      <p className="text-center font-sans text-xs leading-relaxed text-stone-dark">
        Have an account? Your orders are always under{" "}
        <a href="/account/orders" className="text-gold underline underline-offset-4">
          order history
        </a>
        .
      </p>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary btn-lg w-full">
      {pending ? "Looking it up" : "Find my order"}
    </button>
  );
}
