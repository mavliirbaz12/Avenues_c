import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer, ExternalLink } from "lucide-react";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPaise, formatDateTime } from "@/lib/format";
import { AdminPageHeader, AdminStatusChip, AdminChip } from "@/components/admin/ui";
import { AdminOrderActions, AdminNoteForm } from "@/components/admin/admin-order-actions";
import { orderAccessToken } from "@/lib/commerce/order-token";
import { requireAdmin } from "@/lib/auth-guards";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
      refunds: { orderBy: { createdAt: "desc" } },
      shipment: { include: { events: { orderBy: { occurredAt: "desc" }, take: 12 } } },
      returnRequest: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!order) notFound();

  /**
   * Packing list for any gift set on this order.
   *
   * Read live rather than snapshotted onto OrderItem: what matters at the
   * bench is what the box contains TODAY. If the composition changed after the
   * order was placed, the packer must follow the current recipe, not a stale
   * copy — the customer is shipped whatever the set is now.
   */
  const comboContents = new Map<string, { name: string; sizeLabel: string }[]>();
  const variantIds = order.items.map((i) => i.variantId).filter((v): v is string => Boolean(v));
  if (variantIds.length) {
    const rows = await prisma.comboItem.findMany({
      where: { combo: { type: "COMBO", variants: { some: { id: { in: variantIds } } } } },
      orderBy: { position: "asc" },
      select: {
        sizeLabel: true,
        product: { select: { name: true } },
        combo: { select: { variants: { select: { id: true } } } },
      },
    });
    for (const r of rows) {
      for (const v of r.combo.variants) {
        const list = comboContents.get(v.id) ?? [];
        list.push({ name: r.product.name, sizeLabel: r.sizeLabel });
        comboContents.set(v.id, list);
      }
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/orders" className="inline-flex items-center gap-2 font-sans text-[0.6875rem] uppercase tracking-label text-stone transition-colors hover:text-gold-light">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.6} />
        Orders
      </Link>

      <div className="mt-4">
        <AdminPageHeader
          title={order.orderNumber}
          actions={
            <>
              {order.invoiceNumber && (
                <Link href={`/admin/orders/${order.id}/invoice`} target="_blank" className="btn btn-ghost btn-sm">
                  <Printer className="h-3.5 w-3.5" strokeWidth={1.6} />
                  Invoice
                </Link>
              )}
              <Link
                href={`/order/${order.orderNumber}?t=${orderAccessToken(order.id)}`}
                target="_blank"
                className="btn btn-ghost btn-sm"
              >
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.6} />
                Customer view
              </Link>
            </>
          }
        >
          <p className="mt-2 flex flex-wrap items-center gap-2 font-sans text-xs text-stone">
            <AdminStatusChip status={order.status} />
            <AdminChip tone={order.paymentStatus === PaymentStatus.PAID ? "ok" : order.paymentStatus === PaymentStatus.REFUNDED ? "quiet" : "warn"}>
              {order.paymentMethod} · {order.paymentStatus.toLowerCase().replace(/_/g, " ")}
            </AdminChip>
            {order.invoiceNumber && <span className="text-stone-dark">Invoice {order.invoiceNumber}</span>}
            <span className="text-stone-dark">Placed {formatDateTime(order.placedAt ?? order.createdAt)}</span>
          </p>
        </AdminPageHeader>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-5">
        {/* Left: items, payments, tracking */}
        <div className="space-y-8 lg:col-span-3">
          <section className="border border-line">
            <h2 className="border-b border-line px-4 py-3 font-sans text-xs uppercase tracking-wide2 text-bone">Items</h2>
            <ul className="divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.id} className="px-4 py-3 font-sans text-xs">
                  <div className="flex items-baseline gap-4">
                    <span className="min-w-0 flex-1 text-bone">
                      {item.productName} <span className="text-stone-dark">· {item.variantSize} · {item.sku}</span>
                    </span>
                    <span className="text-stone-dark">× {item.quantity}</span>
                    <span className="w-20 text-right tabular-nums text-bone">{formatPaise(item.totalPaise)}</span>
                  </div>

                  {/* What goes in the box, for whoever is packing it. */}
                  {item.variantId && comboContents.has(item.variantId) && (
                    <ul
                      className="mt-2 space-y-1 border-l border-gold/30 pl-3"
                      data-testid="packing-contents"
                    >
                      {comboContents.get(item.variantId)!.map((c, n) => (
                        <li key={n} className="text-stone">
                          {c.name} <span className="text-stone-dark">· {c.sizeLabel}</span>
                          {item.quantity > 1 && (
                            <span className="text-stone-dark"> × {item.quantity}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-line px-4 py-3 font-sans text-xs">
              <Row label="Subtotal">{formatPaise(order.subtotalPaise)}</Row>
              {order.discountPaise > 0 && <Row label={`Discount (${order.couponCode})`}>−{formatPaise(order.discountPaise)}</Row>}
              <Row label="Shipping">{order.shippingPaise === 0 ? "Free" : formatPaise(order.shippingPaise)}</Row>
              {order.codFeePaise > 0 && <Row label="COD fee">{formatPaise(order.codFeePaise)}</Row>}
              <Row label="Total" strong>{formatPaise(order.totalPaise)}</Row>
            </dl>
          </section>

          {(order.payments.length > 0 || order.refunds.length > 0) && (
            <section className="border border-line">
              <h2 className="border-b border-line px-4 py-3 font-sans text-xs uppercase tracking-wide2 text-bone">Payments & refunds</h2>
              <ul className="divide-y divide-line font-sans text-xs">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
                    <span className="text-stone">{p.razorpayOrderId ?? p.provider}</span>
                    <AdminChip tone={p.status === PaymentStatus.PAID ? "ok" : p.status === PaymentStatus.FAILED ? "danger" : "warn"}>
                      {p.status}
                    </AdminChip>
                    {p.method && <span className="text-stone-dark">{p.method}</span>}
                    {p.errorDescription && <span className="text-danger">{p.errorDescription}</span>}
                    <span className="ml-auto tabular-nums text-bone">{formatPaise(p.amountPaise)}</span>
                  </li>
                ))}
                {order.refunds.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
                    <span className="text-stone">Refund {r.razorpayRefundId ?? ""}</span>
                    <AdminChip tone={r.status === "PROCESSED" ? "ok" : r.status === "FAILED" ? "danger" : "warn"}>{r.status}</AdminChip>
                    <span className="ml-auto tabular-nums text-bone">−{formatPaise(r.amountPaise)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {order.shipment && (
            <section className="border border-line">
              <h2 className="border-b border-line px-4 py-3 font-sans text-xs uppercase tracking-wide2 text-bone">
                Shipment
                {order.shipment.waybill && <span className="ml-3 normal-case tracking-normal text-gold">AWB {order.shipment.waybill}</span>}
              </h2>
              <ul className="divide-y divide-line font-sans text-xs">
                {order.shipment.events.length === 0 ? (
                  <li className="px-4 py-3 text-stone-dark">No scans yet.</li>
                ) : (
                  order.shipment.events.map((e) => (
                    <li key={e.id} className="flex items-baseline gap-4 px-4 py-2.5">
                      <span className="min-w-0 flex-1 text-stone">
                        {e.detail ?? e.status}
                        {e.location && <span className="text-stone-dark"> — {e.location}</span>}
                      </span>
                      <span className="shrink-0 tabular-nums text-stone-dark">{formatDateTime(e.occurredAt)}</span>
                    </li>
                  ))
                )}
              </ul>
            </section>
          )}
        </div>

        {/* Right: actions, customer, notes */}
        <div className="space-y-8 lg:col-span-2">
          <section className="border border-line p-4">
            <h2 className="font-sans text-xs uppercase tracking-wide2 text-bone">Actions</h2>
            <div className="mt-4">
              <AdminOrderActions
                orderId={order.id}
                status={order.status}
                hasWaybill={Boolean(order.shipment?.waybill)}
                canRefund={order.paymentStatus === PaymentStatus.PAID}
                returnStatus={order.returnRequest?.status ?? null}
              />
            </div>
          </section>

          <section className="border border-line p-4 font-sans text-xs">
            <h2 className="text-xs uppercase tracking-wide2 text-bone">Customer</h2>
            <p className="mt-3 text-stone">
              {order.shipName}
              {order.user ? (
                <Link href={`/admin/customers/${order.user.id}`} className="ml-2 text-gold hover:text-gold-light">
                  account
                </Link>
              ) : (
                <AdminChip tone="quiet" className="ml-2">Guest</AdminChip>
              )}
            </p>
            <p className="mt-1 text-stone-dark">
              <a href={`mailto:${order.email}`} className="hover:text-gold-light">{order.email}</a>
              {" · "}
              <a href={`tel:${order.phone}`} className="hover:text-gold-light">{order.phone}</a>
            </p>
            <address className="mt-3 border-t border-line pt-3 not-italic leading-relaxed text-stone">
              {order.shipLine1}
              {order.shipLine2 && <>, {order.shipLine2}</>}
              {order.shipLandmark && <><br />Near {order.shipLandmark}</>}
              <br />
              {order.shipCity}, {order.shipState} {order.shipPincode}
              <br />
              {order.shipPhone}
              {order.shipAltPhone && <> · {order.shipAltPhone}</>}
            </address>
            {order.customerNote && (
              <p className="mt-3 border-t border-line pt-3 text-stone">
                <span className="text-stone-dark">Customer note: </span>
                {order.customerNote}
              </p>
            )}
            {order.cancelReason && (
              <p className="mt-3 border-t border-line pt-3 text-danger">
                <span className="text-stone-dark">Cancellation: </span>
                {order.cancelReason}
              </p>
            )}
            {order.returnRequest && (
              <p className="mt-3 border-t border-line pt-3 text-warning">
                <span className="text-stone-dark">Return reason: </span>
                {order.returnRequest.reason}
              </p>
            )}
          </section>

          <section className="border border-line p-4">
            <h2 className="font-sans text-xs uppercase tracking-wide2 text-bone">Internal note</h2>
            <div className="mt-3">
              <AdminNoteForm orderId={order.id} note={order.adminNote} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={strong ? "text-bone" : "text-stone-dark"}>{label}</dt>
      <dd className={strong ? "tabular-nums text-bone" : "tabular-nums text-stone"}>{children}</dd>
    </div>
  );
}
