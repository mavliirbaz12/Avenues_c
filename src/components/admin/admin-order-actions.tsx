"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { OrderStatus, ReturnStatus } from "@prisma/client";
import { Truck, RefreshCw, Loader2 } from "lucide-react";
import {
  adminCreateShipment,
  adminRefreshTracking,
  adminSetStatus,
  adminCancelOrder,
  adminResolveReturn,
  adminSaveNote,
  ADMIN_ORDER_IDLE,
} from "@/app/actions/admin/orders";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

/** The action rail on an admin order: ship, track, move, cancel, resolve returns. */
export function AdminOrderActions({
  orderId,
  status,
  hasWaybill,
  canRefund,
  returnStatus,
}: {
  orderId: string;
  status: OrderStatus;
  hasWaybill: boolean;
  canRefund: boolean;
  returnStatus: ReturnStatus | null;
}) {
  const toast = useUI((s) => s.toast);
  const [busy, startTransition] = useTransition();

  const canShip = !hasWaybill && (status === OrderStatus.CONFIRMED || status === OrderStatus.PACKED);
  const manualMoves: { to: OrderStatus; label: string }[] = (
    {
      [OrderStatus.CONFIRMED]: [{ to: OrderStatus.PACKED, label: "Mark packed" }],
      [OrderStatus.PACKED]: [{ to: OrderStatus.SHIPPED, label: "Mark shipped" }],
      [OrderStatus.SHIPPED]: [{ to: OrderStatus.DELIVERED, label: "Mark delivered" }],
      [OrderStatus.IN_TRANSIT]: [{ to: OrderStatus.DELIVERED, label: "Mark delivered" }],
      [OrderStatus.OUT_FOR_DELIVERY]: [{ to: OrderStatus.DELIVERED, label: "Mark delivered" }],
      [OrderStatus.RTO]: [{ to: OrderStatus.RETURNED, label: "Mark returned (RTO received)" }],
    } as Partial<Record<OrderStatus, { to: OrderStatus; label: string }[]>>
  )[status] ?? [];

  function run(fn: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const res = await fn();
      toast({ title: res.message, tone: res.ok ? "default" : "danger" });
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canShip && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => adminCreateShipment(orderId))}
            className="btn btn-primary btn-sm"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin-slow" strokeWidth={1.8} /> : <Truck className="h-3.5 w-3.5" strokeWidth={1.6} />}
            Generate Delhivery shipment
          </button>
        )}

        {hasWaybill && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => adminRefreshTracking(orderId))}
            className="btn btn-ghost btn-sm"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin-slow")} strokeWidth={1.6} />
            Refresh tracking
          </button>
        )}

        {manualMoves.map((m) => (
          <button
            key={m.to}
            type="button"
            disabled={busy}
            onClick={() => run(() => adminSetStatus(orderId, m.to))}
            className="btn btn-outline btn-sm"
          >
            {m.label}
          </button>
        ))}
      </div>

      {returnStatus && <ReturnResolver orderId={orderId} returnStatus={returnStatus} canRefund={canRefund} />}

      <CancelForm orderId={orderId} status={status} />
    </div>
  );
}

function CancelForm({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [state, action] = useActionState(adminCancelOrder, ADMIN_ORDER_IDLE);
  const [open, setOpen] = useState(false);

  const cancellable = (
    [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.PACKED,
      OrderStatus.SHIPPED,
      OrderStatus.IN_TRANSIT,
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.RTO,
    ] as OrderStatus[]
  ).includes(status);

  if (!cancellable) return null;
  if (state.ok) return <p className="font-sans text-xs text-gold-light" role="status">{state.message}</p>;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="font-sans text-[0.6875rem] uppercase tracking-wide2 text-stone transition-colors hover:text-danger">
        Cancel this order
      </button>
    );
  }

  return (
    <form action={action} className="border border-danger/30 p-4">
      <input type="hidden" name="orderId" value={orderId} />
      <p className="font-sans text-xs text-danger">
        Cancels the order, restores stock, and refunds any online payment in full.
      </p>
      <input name="reason" required placeholder="Reason (goes on the record)" className="field mt-3 text-xs" />
      {state.message && !state.ok && <p className="mt-2 font-sans text-xs text-danger">{state.message}</p>}
      <div className="mt-3 flex gap-2">
        <CancelSubmit />
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">Keep order</button>
      </div>
    </form>
  );
}

function CancelSubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-danger btn-sm">
      {pending ? "Cancelling" : "Cancel & refund"}
    </button>
  );
}

function ReturnResolver({
  orderId,
  returnStatus,
  canRefund,
}: {
  orderId: string;
  returnStatus: ReturnStatus;
  canRefund: boolean;
}) {
  const [state, action] = useActionState(adminResolveReturn, ADMIN_ORDER_IDLE);

  if (state.ok) return <p className="font-sans text-xs text-gold-light" role="status">{state.message}</p>;
  if (returnStatus === ReturnStatus.COMPLETED || returnStatus === ReturnStatus.REJECTED) return null;

  return (
    <form action={action} className="border border-warning/35 p-4">
      <input type="hidden" name="orderId" value={orderId} />
      <p className="font-sans text-xs uppercase tracking-wide2 text-warning">
        {returnStatus === ReturnStatus.REQUESTED ? "Return requested" : "Return approved — parcel on its way back"}
      </p>

      <input name="note" placeholder="Note to file (optional)" className="field mt-3 text-xs" />

      {canRefund && returnStatus === ReturnStatus.APPROVED && (
        <label className="mt-3 flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" name="refund" value="yes" defaultChecked className="h-4 w-4 accent-[#C9A24B]" />
          <span className="font-sans text-xs text-stone">Refund the full amount via Razorpay on completion</span>
        </label>
      )}

      {state.message && !state.ok && <p className="mt-2 font-sans text-xs text-danger">{state.message}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {returnStatus === ReturnStatus.REQUESTED ? (
          <>
            <ReturnSubmit decision="APPROVED" label="Approve return" primary />
            <ReturnSubmit decision="REJECTED" label="Reject" />
          </>
        ) : (
          <ReturnSubmit decision="COMPLETED" label="Parcel received — complete return" primary />
        )}
      </div>
    </form>
  );
}

function ReturnSubmit({ decision, label, primary }: { decision: string; label: string; primary?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="decision"
      value={decision}
      disabled={pending}
      className={cn("btn btn-sm", primary ? "btn-primary" : "btn-ghost")}
    >
      {pending ? "Working" : label}
    </button>
  );
}

export function AdminNoteForm({ orderId, note }: { orderId: string; note: string | null }) {
  const [state, action] = useActionState(adminSaveNote, ADMIN_ORDER_IDLE);

  return (
    <form action={action}>
      <input type="hidden" name="orderId" value={orderId} />
      <textarea
        name="note"
        rows={3}
        defaultValue={note ?? ""}
        placeholder="Internal note — never shown to the customer."
        className="field resize-y text-xs"
      />
      <div className="mt-2 flex items-center gap-3">
        <NoteSubmit />
        {state.message && (
          <span className={cn("font-sans text-xs", state.ok ? "text-gold-light" : "text-danger")}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

function NoteSubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-ghost btn-sm">
      {pending ? "Saving" : "Save note"}
    </button>
  );
}
