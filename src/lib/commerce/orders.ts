import { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/format";
import { priceCart, codAllowed, type CartIntent } from "./pricing";
import { createGatewayOrder } from "@/lib/payments/razorpay";
import { sendOrderConfirmedEmail } from "./order-emails";
import { orderAccessToken } from "./order-token";
import { env } from "@/lib/env";

/**
 * Order lifecycle.
 *
 * The invariants that matter:
 *
 *  - Stock is decremented ATOMICALLY at order creation with a guarded
 *    conditional update — two people cannot buy the last bottle. The
 *    reservation is recorded via stockCommittedAt / stockReleasedAt so every
 *    later transition (payment success, failure, timeout, retry, cancel) can
 *    reason about whether this order currently holds inventory.
 *
 *  - Confirmation is IDEMPOTENT. Payment verification and the webhook can
 *    both fire, in any order, more than once; only the first caller inside
 *    the row lock does the work.
 *
 *  - Invoice numbers are allocated inside the confirmation transaction from
 *    a single counter row, so the GST series is sequential and gapless, and
 *    abandoned checkouts never burn a number.
 *
 *  - A failed or abandoned prepaid order stays PENDING with a retry path.
 *    After PAYMENT_TTL the reservation is released back to stock; a retry
 *    after that re-commits stock if it is still available.
 */

const PAYMENT_TTL_MS = 30 * 60 * 1000;

export class OrderError extends Error {
  constructor(
    message: string,
    public code:
      | "EMPTY_CART"
      | "CART_CHANGED"
      | "OUT_OF_STOCK"
      | "COD_UNAVAILABLE"
      | "NOT_FOUND"
      | "NOT_RETRYABLE" = "CART_CHANGED",
  ) {
    super(message);
  }
}

export type ShippingAddressInput = {
  fullName: string;
  phone: string;
  altPhone?: string | null;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
};

export type CreateOrderInput = {
  intents: CartIntent[];
  email: string;
  phone: string;
  address: ShippingAddressInput;
  paymentMethod: PaymentMethod;
  couponCode?: string | null;
  customerNote?: string | null;
  userId?: string | null;
};

export type CreateOrderResult = {
  orderId: string;
  orderNumber: string;
  /** Guest access token for the success/tracking pages. */
  accessToken: string;
  totalPaise: number;
  payment:
    | { kind: "COD" }
    | {
        kind: "RAZORPAY";
        razorpayOrderId: string;
        keyId: string;
        amountPaise: number;
        mock: boolean;
      };
};

/* -------------------------------------------------------------------------- */
/* Create                                                                      */
/* -------------------------------------------------------------------------- */

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  // Housekeeping ride-along: free any reservations that have timed out, so
  // stock trapped by an abandoned checkout returns before we price this one.
  await releaseExpiredReservations().catch(() => {});

  const priced = await priceCart(input.intents, {
    couponCode: input.couponCode ?? null,
    paymentMethod: input.paymentMethod,
    userId: input.userId ?? null,
  });

  if (priced.lines.length === 0) {
    throw new OrderError("Your cart is empty.", "EMPTY_CART");
  }

  // Never silently order less than the customer thinks they're buying. If
  // anything was dropped or clamped since they last looked, stop and let the
  // cart re-sync — the UI shows exactly what changed.
  if (priced.dropped.length > 0 || priced.lines.some((l) => l.clampedFrom !== undefined)) {
    throw new OrderError(
      "Availability changed while you were checking out. Review your cart and try again.",
      "CART_CHANGED",
    );
  }

  if (input.paymentMethod === PaymentMethod.COD && !codAllowed(priced.settings, priced.totalPaise)) {
    throw new OrderError("Cash on delivery isn't available for this order.", "COD_UNAVAILABLE");
  }

  const orderNumber = generateOrderNumber();
  const now = new Date();

  const order = await prisma.$transaction(
    async (tx) => {
      // The oversell guard. updateMany with a stock >= qty predicate either
      // decrements exactly one row or matches nothing — there is no window in
      // which two orders can both take the last unit.
      for (const line of priced.lines) {
        const res = await tx.variant.updateMany({
          where: { id: line.variantId, isActive: true, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (res.count !== 1) {
          throw new OrderError(
            `${line.name} (${line.size}) sold out while you were checking out.`,
            "OUT_OF_STOCK",
          );
        }
      }

      return tx.order.create({
        data: {
          orderNumber,
          userId: input.userId ?? null,
          status: OrderStatus.PENDING,
          paymentMethod: input.paymentMethod,
          paymentStatus: PaymentStatus.PENDING,
          email: input.email.toLowerCase(),
          phone: input.phone,

          shipName: input.address.fullName,
          shipPhone: input.address.phone,
          shipAltPhone: input.address.altPhone || null,
          shipLine1: input.address.line1,
          shipLine2: input.address.line2 || null,
          shipLandmark: input.address.landmark || null,
          shipCity: input.address.city,
          shipState: input.address.state,
          shipPincode: input.address.pincode,

          subtotalPaise: priced.subtotalPaise,
          discountPaise: priced.discountPaise,
          shippingPaise: priced.shippingPaise,
          codFeePaise: priced.codFeePaise,
          totalPaise: priced.totalPaise,

          couponId: priced.coupon.status === "applied" ? priced.coupon.couponId : null,
          couponCode: priced.coupon.status === "applied" ? priced.coupon.code : null,

          customerNote: input.customerNote || null,
          termsAcceptedAt: now,
          stockCommittedAt: now,
          paymentExpiresAt:
            input.paymentMethod === PaymentMethod.RAZORPAY
              ? new Date(now.getTime() + PAYMENT_TTL_MS)
              : null,

          items: {
            create: priced.lines.map((l) => ({
              variantId: l.variantId,
              productName: l.name,
              productSlug: l.slug,
              variantSize: l.size,
              sku: l.sku,
              imageUrl: l.imageUrl,
              mrpPaise: l.mrpPaise,
              unitPricePaise: l.unitPricePaise,
              quantity: l.quantity,
              totalPaise: l.totalPaise,
            })),
          },
        },
        select: { id: true, orderNumber: true, totalPaise: true },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );

  if (input.paymentMethod === PaymentMethod.COD) {
    // COD needs no gateway round-trip — confirm on the spot.
    await confirmOrder(order.id, { paidNow: false });
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      accessToken: orderAccessToken(order.id),
      totalPaise: order.totalPaise,
      payment: { kind: "COD" },
    };
  }

  const gateway = await createGatewayOrder({
    amountPaise: order.totalPaise,
    receipt: order.orderNumber,
    notes: { orderId: order.id },
  });

  await prisma.payment.create({
    data: {
      orderId: order.id,
      razorpayOrderId: gateway.razorpayOrderId,
      amountPaise: order.totalPaise,
      status: PaymentStatus.PENDING,
    },
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    accessToken: orderAccessToken(order.id),
    totalPaise: order.totalPaise,
    payment: {
      kind: "RAZORPAY",
      razorpayOrderId: gateway.razorpayOrderId,
      keyId: env.RAZORPAY_KEY_ID,
      amountPaise: order.totalPaise,
      mock: gateway.mock,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Confirm                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Confirms an order. Idempotent — safe to call from the payment-verify
 * endpoint, the webhook, and COD creation, in any order and any number of
 * times.
 */
export async function confirmOrder(
  orderId: string,
  opts: {
    paidNow: boolean;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    paymentRaw?: unknown;
  },
) {
  const confirmed = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        couponId: true,
        userId: true,
        discountPaise: true,
      },
    });
    if (!order) return null;

    // Already confirmed (or further along) — nothing to do. This is the
    // idempotency gate for double webhook delivery.
    if (order.status !== OrderStatus.PENDING) return null;

    // Sequential, gapless invoice number, allocated only now that the order
    // is real. The single-row update serialises concurrent confirmations.
    const settings = await tx.storeSetting.update({
      where: { id: 1 },
      data: { invoiceNextNumber: { increment: 1 } },
      select: { invoicePrefix: true, invoiceNextNumber: true },
    });
    const invoiceNumber = `${settings.invoicePrefix}-${String(settings.invoiceNextNumber - 1).padStart(6, "0")}`;

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.CONFIRMED,
        paymentStatus: opts.paidNow ? PaymentStatus.PAID : PaymentStatus.PENDING,
        invoiceNumber,
        invoicedAt: new Date(),
        placedAt: new Date(),
        paymentExpiresAt: null,
      },
    });

    if (opts.razorpayPaymentId) {
      await tx.payment.updateMany({
        where: { orderId: order.id, status: PaymentStatus.PENDING },
        data: {
          status: PaymentStatus.PAID,
          razorpayPaymentId: opts.razorpayPaymentId,
          razorpaySignature: opts.razorpaySignature ?? null,
          raw: opts.paymentRaw ? (opts.paymentRaw as Prisma.InputJsonValue) : undefined,
        },
      });
    }

    if (order.couponId) {
      await tx.coupon.update({
        where: { id: order.couponId },
        data: { usedCount: { increment: 1 } },
      });
      // orderId is unique on redemptions, so a webhook/verify race cannot
      // record the same redemption twice.
      await tx.couponRedemption
        .create({
          data: {
            couponId: order.couponId,
            userId: order.userId,
            orderId: order.id,
            amountPaise: order.discountPaise,
          },
        })
        .catch((err) => {
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"))
            throw err;
        });
    }

    // The purchase happened — empty the account cart.
    if (order.userId) {
      await tx.cartItem.deleteMany({ where: { cart: { userId: order.userId } } });
    }

    return order.id;
  });

  if (!confirmed) return false;

  // Email outside the transaction; a mail failure must not unconfirm an order.
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (order) {
    await sendOrderConfirmedEmail({
      id: order.id,
      orderNumber: order.orderNumber,
      email: order.email,
      paymentMethod: order.paymentMethod,
      totalPaise: order.totalPaise,
      shipName: order.shipName,
      shipLine1: order.shipLine1,
      shipLine2: order.shipLine2,
      shipCity: order.shipCity,
      shipState: order.shipState,
      shipPincode: order.shipPincode,
      items: order.items.map((i) => ({
        productName: i.productName,
        variantSize: i.variantSize,
        quantity: i.quantity,
        totalPaise: i.totalPaise,
      })),
    }).catch((err) => console.error("[orders] confirmation email failed:", err));
  }

  return true;
}

/* -------------------------------------------------------------------------- */
/* Failure & release                                                           */
/* -------------------------------------------------------------------------- */

/** Records a failed payment attempt. The order stays PENDING and retryable. */
export async function markPaymentFailed(args: {
  razorpayOrderId: string;
  errorCode?: string | null;
  errorDescription?: string | null;
  raw?: unknown;
}) {
  await prisma.payment.updateMany({
    where: { razorpayOrderId: args.razorpayOrderId, status: PaymentStatus.PENDING },
    data: {
      status: PaymentStatus.FAILED,
      errorCode: args.errorCode ?? null,
      errorDescription: args.errorDescription ?? null,
      raw: args.raw ? (args.raw as Prisma.InputJsonValue) : undefined,
    },
  });
}

/**
 * Returns reserved stock from prepaid orders whose payment window lapsed.
 * The order itself stays PENDING — the customer keeps a retry link, which
 * re-commits stock if it is still available.
 *
 * Called opportunistically from createOrder and from /api/cron/release-stock.
 */
export async function releaseExpiredReservations() {
  const stale = await prisma.order.findMany({
    where: {
      status: OrderStatus.PENDING,
      paymentMethod: PaymentMethod.RAZORPAY,
      paymentExpiresAt: { lt: new Date() },
      stockCommittedAt: { not: null },
      stockReleasedAt: null,
    },
    select: { id: true },
    take: 20,
  });

  let released = 0;

  for (const { id } of stale) {
    await prisma
      .$transaction(async (tx) => {
        // Guarded re-read inside the transaction: only one worker wins the
        // release, and a payment that landed in the meantime aborts it.
        const order = await tx.order.findFirst({
          where: {
            id,
            status: OrderStatus.PENDING,
            stockReleasedAt: null,
            paymentExpiresAt: { lt: new Date() },
          },
          select: { id: true, items: { select: { variantId: true, quantity: true } } },
        });
        if (!order) return;

        for (const item of order.items) {
          if (!item.variantId) continue;
          await tx.variant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: { stockReleasedAt: new Date() },
        });

        released += 1;
      })
      .catch((err) => console.error(`[orders] releasing ${id} failed:`, err));
  }

  return released;
}

/* -------------------------------------------------------------------------- */
/* Retry                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Issues a fresh gateway order for a still-PENDING prepaid order. If the
 * reservation was released by timeout, stock is re-committed first — and if
 * it is genuinely gone, the retry fails honestly.
 */
export async function retryPayment(orderId: string): Promise<CreateOrderResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      totalPaise: true,
      stockReleasedAt: true,
      items: { select: { variantId: true, quantity: true, productName: true, variantSize: true } },
    },
  });

  if (!order) throw new OrderError("Order not found.", "NOT_FOUND");
  if (
    order.paymentMethod !== PaymentMethod.RAZORPAY ||
    order.status !== OrderStatus.PENDING ||
    order.paymentStatus === PaymentStatus.PAID
  ) {
    throw new OrderError("This order can't be paid again.", "NOT_RETRYABLE");
  }

  await prisma.$transaction(async (tx) => {
    if (order.stockReleasedAt) {
      for (const item of order.items) {
        if (!item.variantId) {
          throw new OrderError(
            `${item.productName} is no longer available.`,
            "OUT_OF_STOCK",
          );
        }
        const res = await tx.variant.updateMany({
          where: { id: item.variantId, isActive: true, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (res.count !== 1) {
          throw new OrderError(
            `${item.productName} (${item.variantSize}) has sold out since. Start a fresh order.`,
            "OUT_OF_STOCK",
          );
        }
      }
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        stockCommittedAt: new Date(),
        stockReleasedAt: null,
        paymentExpiresAt: new Date(Date.now() + PAYMENT_TTL_MS),
      },
    });
  });

  const gateway = await createGatewayOrder({
    amountPaise: order.totalPaise,
    receipt: order.orderNumber,
    notes: { orderId: order.id, retry: "true" },
  });

  await prisma.payment.create({
    data: {
      orderId: order.id,
      razorpayOrderId: gateway.razorpayOrderId,
      amountPaise: order.totalPaise,
      status: PaymentStatus.PENDING,
    },
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    accessToken: orderAccessToken(order.id),
    totalPaise: order.totalPaise,
    payment: {
      kind: "RAZORPAY",
      razorpayOrderId: gateway.razorpayOrderId,
      keyId: env.RAZORPAY_KEY_ID,
      amountPaise: order.totalPaise,
      mock: gateway.mock,
    },
  };
}
