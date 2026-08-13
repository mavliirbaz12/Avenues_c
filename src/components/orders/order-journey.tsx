import { OrderStatus } from "@prisma/client";
import { Check, X } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The Order Journey — the customer-facing tracking timeline.
 *
 * Placed → Packed → Shipped → In transit → Out for delivery → Delivered,
 * with a gold thread advancing through the milestones. Cancelled, returned
 * and RTO orders swap the thread for a terminal notice instead of pretending
 * the journey continues.
 */

const MILESTONES: { key: OrderStatus; label: string; detail: string }[] = [
  { key: OrderStatus.CONFIRMED, label: "Order placed", detail: "Confirmed and queued for packing" },
  { key: OrderStatus.PACKED, label: "Packed", detail: "Sealed and ready for pickup" },
  { key: OrderStatus.SHIPPED, label: "Shipped", detail: "Handed to the courier" },
  { key: OrderStatus.IN_TRANSIT, label: "In transit", detail: "Moving through the network" },
  { key: OrderStatus.OUT_FOR_DELIVERY, label: "Out for delivery", detail: "With your delivery rider" },
  { key: OrderStatus.DELIVERED, label: "Delivered", detail: "It has arrived" },
];

const TERMINAL: Partial<Record<OrderStatus, { label: string; body: string }>> = {
  [OrderStatus.CANCELLED]: {
    label: "Cancelled",
    body: "This order was cancelled. Any payment made is on its way back to you.",
  },
  [OrderStatus.RETURN_REQUESTED]: {
    label: "Return requested",
    body: "We have your return request and will be in touch shortly.",
  },
  [OrderStatus.RETURNED]: {
    label: "Returned",
    body: "This order has been returned and closed.",
  },
  [OrderStatus.RTO]: {
    label: "Returning to us",
    body: "Delivery could not be completed and the parcel is on its way back.",
  },
  [OrderStatus.FAILED]: {
    label: "Not completed",
    body: "Payment for this order was never completed, so it was closed.",
  },
};

export type JourneyEvent = {
  status: string;
  detail: string | null;
  location: string | null;
  occurredAt: Date;
};

export function OrderJourney({
  status,
  paymentPending,
  events,
  expectedDeliveryAt,
  className,
}: {
  status: OrderStatus;
  /** PENDING prepaid order — journey hasn't started yet. */
  paymentPending: boolean;
  events: JourneyEvent[];
  expectedDeliveryAt?: Date | null;
  className?: string;
}) {
  const terminal = TERMINAL[status];

  if (paymentPending) {
    return (
      <div className={cn("border border-warning/40 bg-warning/[0.06] p-5", className)}>
        <p className="font-sans text-sm leading-relaxed text-warning">
          Waiting for payment. The journey begins the moment it goes through.
        </p>
      </div>
    );
  }

  if (terminal) {
    return (
      <div className={cn("border border-line bg-surface/60 p-5", className)}>
        <p className="flex items-center gap-2.5 font-sans text-sm text-bone">
          <X className="h-4 w-4 text-danger" strokeWidth={1.6} />
          {terminal.label}
        </p>
        <p className="mt-2 font-sans text-sm leading-relaxed text-stone">{terminal.body}</p>
      </div>
    );
  }

  const currentIndex = Math.max(
    0,
    MILESTONES.findIndex((m) => m.key === status),
  );

  return (
    <div className={className}>
      <ol className="relative">
        {MILESTONES.map((m, i) => {
          const done = i < currentIndex;
          const current = i === currentIndex;
          const last = i === MILESTONES.length - 1;

          return (
            <li key={m.key} className="relative flex gap-5 pb-8 last:pb-0">
              {/* The thread */}
              {!last && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-[0.6875rem] top-7 h-[calc(100%-1.25rem)] w-px",
                    done ? "bg-gold/60" : "bg-line-strong",
                  )}
                />
              )}

              {/* The node */}
              <span
                aria-hidden="true"
                className={cn(
                  "relative z-[1] flex h-[1.4rem] w-[1.4rem] shrink-0 items-center justify-center rounded-pill border transition-colors",
                  done || current
                    ? "border-gold bg-gold/15 text-gold"
                    : "border-line-strong bg-ink text-transparent",
                  current && "shadow-[0_0_14px_rgba(201,162,75,0.45)]",
                )}
              >
                {done ? (
                  <Check className="h-3 w-3" strokeWidth={2.4} />
                ) : (
                  <span
                    className={cn("h-1.5 w-1.5 rounded-pill", current ? "bg-gold" : "bg-line-strong")}
                  />
                )}
              </span>

              <div className="min-w-0 pt-0.5">
                <p
                  className={cn(
                    "font-sans text-sm",
                    done || current ? "text-bone" : "text-stone-dark",
                  )}
                >
                  {m.label}
                  {current && status !== OrderStatus.DELIVERED && (
                    <span className="ml-2.5 micro-label-gold">Now</span>
                  )}
                </p>
                <p className="mt-0.5 font-sans text-xs leading-relaxed text-stone-dark">
                  {m.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {expectedDeliveryAt && status !== OrderStatus.DELIVERED && (
        <p className="mt-6 border-t border-line pt-5 font-sans text-sm text-stone">
          Expected by{" "}
          <span className="text-gold-light">{formatDateTime(expectedDeliveryAt)}</span>
        </p>
      )}

      {events.length > 0 && (
        <details className="group mt-6 border-t border-line pt-5">
          <summary className="flex cursor-pointer list-none items-center justify-between font-sans text-micro uppercase text-stone transition-colors hover:text-gold-light [&::-webkit-details-marker]:hidden">
            Courier scan history
            <span className="text-stone-dark transition-transform duration-400 ease-smoke group-open:rotate-45">
              +
            </span>
          </summary>
          <ol className="mt-4 space-y-3">
            {[...events]
              .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
              .map((e, i) => (
                <li key={i} className="flex items-baseline justify-between gap-4 font-sans text-xs">
                  <span className="min-w-0 text-stone">
                    {e.detail ?? e.status}
                    {e.location && <span className="text-stone-dark"> — {e.location}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-stone-dark">
                    {formatDateTime(e.occurredAt)}
                  </span>
                </li>
              ))}
          </ol>
        </details>
      )}
    </div>
  );
}
