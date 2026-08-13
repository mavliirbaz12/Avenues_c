import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import { formatPaise, formatDate } from "@/lib/format";
import { BottleFigure } from "@/components/brand/bottle-figure";
import { Sparkle } from "@/components/brand/sparkle";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };

const STATUS_CHIP: Record<OrderStatus, { label: string; tone: "gold" | "quiet" | "danger" | "warn" }> = {
  PENDING: { label: "Payment pending", tone: "warn" },
  CONFIRMED: { label: "Confirmed", tone: "gold" },
  PACKED: { label: "Packed", tone: "gold" },
  SHIPPED: { label: "Shipped", tone: "gold" },
  IN_TRANSIT: { label: "In transit", tone: "gold" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", tone: "gold" },
  DELIVERED: { label: "Delivered", tone: "quiet" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  RETURN_REQUESTED: { label: "Return requested", tone: "warn" },
  RETURNED: { label: "Returned", tone: "quiet" },
  RTO: { label: "Returning to us", tone: "warn" },
  FAILED: { label: "Not completed", tone: "danger" },
};

export default async function OrdersPage() {
  const user = await requireUser("/account/orders");

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { items: { take: 3 } },
  });

  if (orders.length === 0) {
    return (
      <div className="border border-line px-6 py-16 text-center">
        <Sparkle className="mx-auto h-3.5 w-3.5 text-gold/50" />
        <h2 className="mt-5 font-display text-2xl font-light text-bone">No orders yet</h2>
        <p className="mx-auto mt-3 max-w-sm font-sans text-sm leading-relaxed text-stone">
          When you order, it appears here with a live journey from our door to
          yours. Ordered as a guest with a different email? Sign in with that
          address and it will follow you over.
        </p>
        <Link href="/shop" className="btn btn-outline btn-md mt-7">
          Shop the five
        </Link>
      </div>
    );
  }

  return (
    <div>
      <header>
        <h2 className="font-display text-d5 font-light text-bone">Order history</h2>
        <p className="mt-2 font-sans text-sm text-stone">
          {orders.length} order{orders.length === 1 ? "" : "s"} — tap any of them
          for the live journey and receipt.
        </p>
      </header>

      <ul className="mt-8 space-y-4">
        {orders.map((order) => {
          const chip = STATUS_CHIP[order.status];
          const extra = order.items.length > 2 ? order.items.length - 2 : 0;

          return (
            <li key={order.id}>
              <Link
                href={`/order/${order.orderNumber}`}
                className="group flex flex-wrap items-center gap-5 border border-line p-5 transition-colors duration-400 ease-smoke hover:border-gold/40"
              >
                {/* Item thumbnails, stacked */}
                <div className="flex -space-x-3">
                  {order.items.slice(0, 2).map((item) => (
                    <span
                      key={item.id}
                      className="relative h-16 w-14 shrink-0 overflow-hidden border border-line bg-ink-deep"
                    >
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                      ) : (
                        <BottleFigure slug={item.productSlug} />
                      )}
                    </span>
                  ))}
                  {extra > 0 && (
                    <span className="flex h-16 w-14 shrink-0 items-center justify-center border border-line bg-surface font-sans text-xs text-stone">
                      +{extra}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-sans text-sm text-bone transition-colors group-hover:text-gold-light">
                    {order.orderNumber}
                  </p>
                  <p className="mt-1 font-sans text-xs text-stone">
                    {formatDate(order.placedAt ?? order.createdAt)} &middot;{" "}
                    {order.items.reduce((n, i) => n + i.quantity, 0)} item
                    {order.items.reduce((n, i) => n + i.quantity, 0) === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="flex items-center gap-5">
                  <span
                    className={cn(
                      "border px-3 py-1.5 font-sans text-[0.625rem] uppercase tracking-label",
                      chip.tone === "gold" && "border-gold/40 text-gold",
                      chip.tone === "quiet" && "border-line-strong text-stone",
                      chip.tone === "danger" && "border-danger/40 text-danger",
                      chip.tone === "warn" && "border-warning/40 text-warning",
                    )}
                  >
                    {chip.label}
                  </span>
                  <span className="font-sans text-sm tabular-nums text-bone">
                    {formatPaise(order.totalPaise)}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
