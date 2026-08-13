import { OrderStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

/** Shared admin primitives — dense, flat, scannable. */

const ORDER_CHIP: Record<OrderStatus, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "border-warning/40 text-warning" },
  CONFIRMED: { label: "Confirmed", cls: "border-gold/45 text-gold" },
  PACKED: { label: "Packed", cls: "border-gold/45 text-gold" },
  SHIPPED: { label: "Shipped", cls: "border-gold/45 text-gold" },
  IN_TRANSIT: { label: "In transit", cls: "border-gold/45 text-gold" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", cls: "border-gold/45 text-gold" },
  DELIVERED: { label: "Delivered", cls: "border-line-strong text-stone" },
  CANCELLED: { label: "Cancelled", cls: "border-danger/40 text-danger" },
  RETURN_REQUESTED: { label: "Return req.", cls: "border-warning/40 text-warning" },
  RETURNED: { label: "Returned", cls: "border-line-strong text-stone" },
  RTO: { label: "RTO", cls: "border-warning/40 text-warning" },
  FAILED: { label: "Failed", cls: "border-danger/40 text-danger" },
};

export function AdminStatusChip({ status, className }: { status: OrderStatus; className?: string }) {
  const chip = ORDER_CHIP[status];
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap border px-2 py-0.5 font-sans text-[0.625rem] uppercase tracking-wide2",
        chip.cls,
        className,
      )}
    >
      {chip.label}
    </span>
  );
}

export function AdminChip({
  tone = "quiet",
  children,
  className,
}: {
  tone?: "gold" | "quiet" | "danger" | "warn" | "ok";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap border px-2 py-0.5 font-sans text-[0.625rem] uppercase tracking-wide2",
        tone === "gold" && "border-gold/45 text-gold",
        tone === "quiet" && "border-line-strong text-stone",
        tone === "danger" && "border-danger/40 text-danger",
        tone === "warn" && "border-warning/40 text-warning",
        tone === "ok" && "border-success/40 text-success",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function AdminPageHeader({
  eyebrow = "Back of house",
  title,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="micro-label-gold">{eyebrow}</p>
        <h1 className="mt-2 font-display text-4xl font-light text-bone">{title}</h1>
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
