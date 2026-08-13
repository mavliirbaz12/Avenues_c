import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-guards";
import { verifyOrderAccessToken, orderAccessToken } from "@/lib/commerce/order-token";
import { formatPaise, formatDate } from "@/lib/format";
import { OrderJourney, type JourneyEvent } from "@/components/orders/order-journey";
import { RetryPaymentButton } from "@/components/orders/retry-payment-button";
import { OrderActions } from "@/components/orders/order-actions";
import { ClearCartOnArrival } from "@/components/orders/clear-cart-on-arrival";
import { PurchaseEvent } from "@/components/analytics/purchase-event";
import { BottleFigure } from "@/components/brand/bottle-figure";
import { GoldArc } from "@/components/brand/gold-arc";
import { Sparkle } from "@/components/brand/sparkle";
import { getStoreSettings, whatsappLink } from "@/lib/settings";
import { syncOrderTracking } from "@/lib/shipping/sync";
import { MessageCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The order page: success screen, live tracking timeline and receipt in one.
 *
 * Access control — one of:
 *  - the signed-in owner of the order, or
 *  - a bearer of the HMAC access token (?t=) from the confirmation email /
 *    checkout redirect. Guests land here through that token.
 * Anyone else is bounced to the public track-order lookup.
 */
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orderNumber } = await params;
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]);

  const stub = await prisma.order.findUnique({
    where: { orderNumber: orderNumber.toUpperCase() },
    select: { id: true },
  });
  if (!stub) notFound();

  // Lazy tracking refresh: viewing the page is what triggers a courier poll,
  // so the journey is live without any cron. Rate-limited internally to one
  // real poll per shipment per 10 minutes.
  await syncOrderTracking(stub.id).catch(() => {});

  const order = await prisma.order.findUnique({
    where: { id: stub.id },
    include: {
      items: true,
      shipment: { include: { events: { orderBy: { occurredAt: "asc" } } } },
    },
  });
  if (!order) notFound();

  const user = await getCurrentUser();
  const isOwner = Boolean(user && order.userId === user.id);
  const token = one("t") ?? null;
  const hasToken = verifyOrderAccessToken(order.id, token);

  if (!isOwner && !hasToken) {
    redirect(`/track?order=${encodeURIComponent(order.orderNumber)}`);
  }

  const justPlaced = one("placed") === "1";
  const paymentFailed = one("failed") === "1";

  const paymentPending =
    order.status === OrderStatus.PENDING &&
    order.paymentMethod === PaymentMethod.RAZORPAY &&
    order.paymentStatus !== PaymentStatus.PAID;

  const settings = await getStoreSettings();
  const wa = whatsappLink(
    settings.whatsappNumber,
    `Hi Avenues, I need help with my order ${order.orderNumber}.`,
  );

  const events: JourneyEvent[] = (order.shipment?.events ?? []).map((e) => ({
    status: e.status,
    detail: e.detail,
    location: e.location,
    occurredAt: e.occurredAt,
  }));

  return (
    <div className="shell py-12 sm:py-16">
      {justPlaced && (
        <>
          <ClearCartOnArrival />
          <PurchaseEvent
            orderNumber={order.orderNumber}
            valuePaise={order.totalPaise}
            items={order.items.map((i) => ({
              name: i.productName,
              sku: i.sku,
              quantity: i.quantity,
              pricePaise: i.unitPricePaise,
            }))}
          />
        </>
      )}

      {/* Header */}
      <header className="text-center">
        {justPlaced ? (
          <>
            <Sparkle className="mx-auto h-4 w-4 text-gold" />
            <h1 className="mt-6 font-display text-d2 font-light text-bone">
              It&rsquo;s yours
            </h1>
            <p className="mx-auto mt-4 max-w-md font-sans text-body-lg leading-relaxed text-stone">
              Order <span className="text-gold-light">{order.orderNumber}</span> is
              confirmed. A receipt is on its way to {order.email}.
            </p>
          </>
        ) : (
          <>
            <p className="micro-label-gold">Order</p>
            <h1 className="mt-4 font-display text-d3 font-light text-bone">
              {order.orderNumber}
            </h1>
            <p className="mt-3 font-sans text-sm text-stone">
              Placed {formatDate(order.placedAt ?? order.createdAt)}
              {order.invoiceNumber && <> &middot; Invoice {order.invoiceNumber}</>}
            </p>
          </>
        )}
        <GoldArc className="mt-8" />
      </header>

      {paymentFailed && paymentPending && (
        <div className="mx-auto mt-8 max-w-2xl border border-danger/40 bg-danger/[0.06] p-5 text-center">
          <p className="font-sans text-sm leading-relaxed text-danger">
            That payment didn&rsquo;t go through — nothing was charged. Your order
            and its stock are held for 30 minutes.
          </p>
        </div>
      )}

      <div className="mt-12 grid gap-12 lg:grid-cols-12 lg:gap-16">
        {/* Journey */}
        <section className="lg:col-span-7" aria-labelledby="journey-heading">
          <h2 id="journey-heading" className="mb-7 font-display text-d5 font-light text-bone">
            The journey
          </h2>

          <OrderJourney
            status={order.status}
            paymentPending={paymentPending}
            events={events}
            expectedDeliveryAt={order.shipment?.expectedDeliveryAt}
          />

          {paymentPending && (
            <RetryPaymentButton
              orderId={order.id}
              accessToken={hasToken ? token : isOwner ? orderAccessToken(order.id) : null}
              prefill={{ name: order.shipName, email: order.email, contact: order.phone }}
              className="mt-8"
            />
          )}

          {order.shipment?.waybill && (
            <p className="mt-8 border-t border-line pt-5 font-sans text-sm text-stone">
              Tracking number (AWB):{" "}
              <span className="text-gold-light">{order.shipment.waybill}</span>
              <span className="text-stone-dark"> · Delhivery</span>
            </p>
          )}

          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2.5 font-sans text-micro uppercase text-gold transition-colors hover:text-gold-light"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={1.4} />
              Need help with this order?
            </a>
          )}

          {/* Cancel before shipment; request a return after delivery. */}
          {([OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PACKED] as OrderStatus[]).includes(
            order.status,
          ) && (
            <OrderActions
              orderId={order.id}
              accessToken={hasToken ? token : isOwner ? orderAccessToken(order.id) : null}
              mode="cancel"
            />
          )}
          {order.status === OrderStatus.DELIVERED && (
            <OrderActions
              orderId={order.id}
              accessToken={hasToken ? token : isOwner ? orderAccessToken(order.id) : null}
              mode="return"
            />
          )}
        </section>

        {/* Receipt */}
        <aside className="lg:col-span-5">
          <div className="card p-6 sm:p-8">
            <h2 className="font-display text-2xl font-light text-bone">Receipt</h2>

            <ul className="mt-6 divide-y divide-line border-y border-line">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4 py-4">
                  <div className="relative h-16 w-14 shrink-0 overflow-hidden border border-line bg-ink-deep">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                    ) : (
                      <BottleFigure slug={item.productSlug} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-sm text-bone">
                      {item.productName.replace(/^Avenues\s+/i, "")}
                    </p>
                    <p className="mt-0.5 font-sans text-xs text-stone-dark">
                      {item.variantSize} × {item.quantity}
                    </p>
                  </div>
                  <p className="shrink-0 font-sans text-sm tabular-nums text-bone">
                    {formatPaise(item.totalPaise)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="mt-5 space-y-2.5 font-sans text-sm">
              <Row label="Subtotal">{formatPaise(order.subtotalPaise)}</Row>
              {order.discountPaise > 0 && (
                <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`} gold>
                  &minus;{formatPaise(order.discountPaise)}
                </Row>
              )}
              <Row label="Delivery">
                {order.shippingPaise === 0 ? "Free" : formatPaise(order.shippingPaise)}
              </Row>
              {order.codFeePaise > 0 && (
                <Row label="Cash on delivery fee">{formatPaise(order.codFeePaise)}</Row>
              )}
            </dl>

            <div className="mt-5 flex items-baseline justify-between border-t border-line pt-5">
              <span className="font-sans text-micro uppercase text-stone">Total</span>
              <span className="font-display text-3xl font-light text-bone">
                {formatPaise(order.totalPaise)}
              </span>
            </div>

            <p className="mt-2 text-right font-sans text-xs text-stone-dark">
              {order.paymentMethod === PaymentMethod.COD
                ? "Payable on delivery"
                : order.paymentStatus === PaymentStatus.PAID
                  ? "Paid online"
                  : "Payment pending"}
            </p>

            <div className="mt-7 border-t border-line pt-5">
              <p className="micro-label mb-3">Delivering to</p>
              <address className="not-italic font-sans text-sm leading-relaxed text-stone">
                {order.shipName}
                <br />
                {order.shipLine1}
                {order.shipLine2 && <>, {order.shipLine2}</>}
                {order.shipLandmark && (
                  <>
                    <br />
                    Near {order.shipLandmark}
                  </>
                )}
                <br />
                {order.shipCity}, {order.shipState} {order.shipPincode}
                <br />
                {order.shipPhone}
              </address>
            </div>
          </div>

          {!user && justPlaced && (
            <div className="card mt-6 border-gold/25 p-6">
              <p className="font-display text-xl font-light text-bone">
                Keep an eye on it
              </p>
              <p className="mt-2 font-sans text-sm leading-relaxed text-stone">
                Create an account with {order.email} and this order — and any
                you&rsquo;ve placed before — appears in your history automatically.
              </p>
              <Link
                href={`/signup?next=${encodeURIComponent("/account/orders")}`}
                className="btn btn-outline btn-sm mt-5"
              >
                Create an account
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
  gold,
}: {
  label: string;
  children: React.ReactNode;
  gold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-stone">{label}</dt>
      <dd className={gold ? "tabular-nums text-gold" : "tabular-nums text-bone"}>{children}</dd>
    </div>
  );
}
