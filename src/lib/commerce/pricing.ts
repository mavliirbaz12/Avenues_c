import { CouponType, OrderStatus, PaymentMethod, type ProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStoreSettings, type StoreSettings } from "@/lib/settings";

/**
 * The single source of truth for what a cart costs.
 *
 * SECURITY: the client sends only (variantId, quantity) pairs. Every price,
 * discount, shipping charge and total is read from the database here. Nothing
 * the browser sends can influence the amount charged — the cart store's
 * prices exist purely to render a UI while the network is in flight.
 *
 * Used by the cart drawer, the cart page, checkout, and order creation, so
 * all four agree by construction rather than by discipline.
 */

export type CartIntent = { variantId: string; quantity: number };

export type PricedLine = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  size: string;
  sku: string;
  imageUrl: string | null;
  /** SINGLE fragrance or COMBO gift set — the cart renders them differently. */
  type: ProductType;
  /** Whether a coupon code may discount this line. Sets default to false. */
  couponEligible: boolean;
  mrpPaise: number;
  unitPricePaise: number;
  quantity: number;
  totalPaise: number;
  stock: number;
  /** Set when the requested quantity exceeded stock and was reduced. */
  clampedFrom?: number;
};

export type DroppedLine = {
  variantId: string;
  name: string;
  reason: "unavailable" | "out-of-stock";
};

export type CouponOutcome =
  | { status: "none" }
  | {
      status: "applied";
      code: string;
      couponId: string;
      discountPaise: number;
      label: string;
      /** Shown beside the discount when some lines were excluded. */
      note?: string;
    }
  | { status: "rejected"; code: string; message: string };

export type PricedCart = {
  lines: PricedLine[];
  dropped: DroppedLine[];
  itemCount: number;
  subtotalPaise: number;
  mrpTotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  codFeePaise: number;
  totalPaise: number;
  coupon: CouponOutcome;
  freeShippingThresholdPaise: number;
  /** How much more to spend to earn free delivery; 0 once earned. */
  toFreeShippingPaise: number;
  settings: StoreSettings;
};

/* -------------------------------------------------------------------------- */
/* Coupons                                                                     */
/* -------------------------------------------------------------------------- */

export async function evaluateCoupon(args: {
  code: string;
  /**
   * The value a coupon may discount — the sum of coupon-eligible lines only,
   * NOT the cart subtotal.
   *
   * Gift sets are priced below the sum of their parts and are created
   * coupon-ineligible, so a cart can legitimately contain both kinds. Both the
   * minimum-order test and the percentage calculation run against this figure:
   * otherwise a customer could clear a ₹999 minimum with an ineligible set and
   * take the discount on a ₹200 eligible item beside it.
   */
  subtotalPaise: number;
  /** True when at least one line was left out of that figure. */
  hasIneligibleLines?: boolean;
  userId?: string | null;
}): Promise<CouponOutcome> {
  const code = args.code.trim().toUpperCase();
  if (!code) return { status: "none" };

  const coupon = await prisma.coupon.findUnique({ where: { code } });

  // Same message for "no such code" and "disabled" so the endpoint cannot be
  // used to enumerate which codes exist.
  if (!coupon || !coupon.isActive) {
    return { status: "rejected", code, message: "That code isn't valid." };
  }

  // Valid code, but nothing in the cart it can touch.
  if (args.subtotalPaise <= 0) {
    return {
      status: "rejected",
      code,
      message: args.hasIneligibleLines
        ? "Gift sets are already discounted, so coupon codes don't apply to them."
        : "That code doesn't apply to this cart.",
    };
  }

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    return { status: "rejected", code, message: "That code isn't active yet." };
  }
  if (coupon.endsAt && coupon.endsAt < now) {
    return { status: "rejected", code, message: "That code has expired." };
  }
  if (coupon.usageLimit !== null) {
    // `usedCount` is only incremented at CONFIRMATION, which for a prepaid
    // order is up to a payment window later — and the retry link keeps that
    // window open indefinitely. Counting only confirmed redemptions therefore
    // let one person stage N unpaid orders that each saw usedCount = 0, then
    // pay them all and redeem a single-use code N times. Orders already holding
    // the code and still payable count against the limit too.
    const held = await prisma.order.count({
      where: {
        couponId: coupon.id,
        status: OrderStatus.PENDING,
        paymentExpiresAt: { gt: new Date() },
      },
    });
    if (coupon.usedCount + held >= coupon.usageLimit) {
      return { status: "rejected", code, message: "That code has been fully claimed." };
    }
  }
  if (args.subtotalPaise < coupon.minOrderPaise) {
    const short = (coupon.minOrderPaise - args.subtotalPaise) / 100;
    return {
      status: "rejected",
      code,
      message: `Spend ₹${short.toLocaleString("en-IN")} more to use this code.`,
    };
  }

  if (coupon.perUserLimit !== null) {
    // Fails CLOSED when there is no signed-in user. The old `&& args.userId`
    // skipped the check entirely for anonymous callers, so a "one per customer"
    // code was unlimited to anyone checking out logged out — and a customer who
    // had used theirs only had to sign out to reset it. A per-customer cap is
    // meaningless without a customer, so the honest answer is to refuse rather
    // than to wave it through. Checkout requires an account, so a real buyer
    // never sees this; it only bites the signed-out cart preview.
    if (!args.userId) {
      return { status: "rejected", code, message: "Sign in to use this code." };
    }
    const used = await prisma.couponRedemption.count({
      where: { couponId: coupon.id, userId: args.userId },
    });
    if (used >= coupon.perUserLimit) {
      return { status: "rejected", code, message: "You've already used this code." };
    }
  }

  let discountPaise: number;
  let label: string;

  if (coupon.type === CouponType.FLAT) {
    discountPaise = coupon.valuePaise ?? 0;
    label = `₹${((coupon.valuePaise ?? 0) / 100).toLocaleString("en-IN")} off`;
  } else {
    const pct = coupon.valuePercent ?? 0;
    // Floor, so rounding never favours the customer over the ledger.
    discountPaise = Math.floor((args.subtotalPaise * pct) / 100);
    if (coupon.maxDiscountPaise !== null) {
      discountPaise = Math.min(discountPaise, coupon.maxDiscountPaise);
    }
    label = `${pct}% off`;
  }

  // A discount can never exceed the goods value, or a coupon plus shipping
  // rules could produce a negative total.
  discountPaise = Math.max(0, Math.min(discountPaise, args.subtotalPaise));

  if (discountPaise === 0) {
    return { status: "rejected", code, message: "That code doesn't apply to this cart." };
  }

  return {
    status: "applied",
    code,
    couponId: coupon.id,
    discountPaise,
    label,
    // The cart shows this beside the discount so a customer is never left
    // wondering why the number is smaller than they expected.
    ...(args.hasIneligibleLines
      ? { note: "Applied to eligible items. Gift sets are already discounted." }
      : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Cart pricing                                                                */
/* -------------------------------------------------------------------------- */

export async function priceCart(
  intents: CartIntent[],
  opts: {
    couponCode?: string | null;
    paymentMethod?: PaymentMethod | null;
    userId?: string | null;
  } = {},
): Promise<PricedCart> {
  const settings = await getStoreSettings();

  // De-duplicate and sanitise before touching the database.
  const wanted = new Map<string, number>();
  for (const intent of intents) {
    if (!intent?.variantId) continue;
    const qty = Math.floor(Number(intent.quantity));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    wanted.set(intent.variantId, Math.min((wanted.get(intent.variantId) ?? 0) + qty, 20));
  }

  const variants = wanted.size
    ? await prisma.variant.findMany({
        where: { id: { in: [...wanted.keys()] } },
        select: {
          id: true,
          size: true,
          sku: true,
          mrpPaise: true,
          pricePaise: true,
          stock: true,
          isActive: true,
          product: {
            select: {
              id: true,
              slug: true,
              name: true,
              isActive: true,
              type: true,
              couponEligible: true,
              images: {
                orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      })
    : [];

  const byId = new Map(variants.map((v) => [v.id, v]));
  const lines: PricedLine[] = [];
  const dropped: DroppedLine[] = [];

  for (const [variantId, requested] of wanted) {
    const v = byId.get(variantId);

    if (!v || !v.isActive || !v.product.isActive) {
      dropped.push({ variantId, name: v?.product.name ?? "An item", reason: "unavailable" });
      continue;
    }
    if (v.stock <= 0) {
      dropped.push({ variantId, name: v.product.name, reason: "out-of-stock" });
      continue;
    }

    const quantity = Math.min(requested, v.stock);

    lines.push({
      variantId: v.id,
      productId: v.product.id,
      slug: v.product.slug,
      name: v.product.name,
      size: v.size,
      sku: v.sku,
      imageUrl: v.product.images[0]?.url ?? null,
      type: v.product.type,
      couponEligible: v.product.couponEligible,
      mrpPaise: v.mrpPaise,
      unitPricePaise: v.pricePaise,
      quantity,
      totalPaise: v.pricePaise * quantity,
      stock: v.stock,
      ...(quantity < requested ? { clampedFrom: requested } : {}),
    });
  }

  const subtotalPaise = lines.reduce((n, l) => n + l.totalPaise, 0);
  const mrpTotalPaise = lines.reduce((n, l) => n + l.mrpPaise * l.quantity, 0);

  // Only eligible lines can be discounted; the rest still count toward the
  // order total, free shipping and COD limits.
  const eligibleSubtotalPaise = lines
    .filter((l) => l.couponEligible)
    .reduce((n, l) => n + l.totalPaise, 0);
  const hasIneligibleLines = lines.some((l) => !l.couponEligible);

  const coupon = opts.couponCode
    ? await evaluateCoupon({
        code: opts.couponCode,
        subtotalPaise: eligibleSubtotalPaise,
        hasIneligibleLines,
        userId: opts.userId,
      })
    : ({ status: "none" } as CouponOutcome);

  const discountPaise = coupon.status === "applied" ? coupon.discountPaise : 0;

  // Free shipping is judged on what the customer actually pays for goods,
  // after any discount — otherwise a coupon could tip an order under the
  // threshold while still shipping free.
  const goodsPaise = subtotalPaise - discountPaise;
  const shippingPaise =
    lines.length === 0 || goodsPaise >= settings.freeShippingThresholdPaise
      ? 0
      : settings.shippingFlatPaise;

  const codFeePaise =
    opts.paymentMethod === PaymentMethod.COD && settings.codEnabled ? settings.codFeePaise : 0;

  const totalPaise = Math.max(0, goodsPaise + shippingPaise + codFeePaise);

  return {
    lines,
    dropped,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotalPaise,
    mrpTotalPaise,
    discountPaise,
    shippingPaise,
    codFeePaise,
    totalPaise,
    coupon,
    freeShippingThresholdPaise: settings.freeShippingThresholdPaise,
    toFreeShippingPaise: Math.max(0, settings.freeShippingThresholdPaise - goodsPaise),
    settings,
  };
}

/** True when COD may be offered for this cart value. */
export function codAllowed(settings: StoreSettings, totalPaise: number) {
  if (!settings.codEnabled) return false;
  if (settings.codMaxOrderPaise !== null && totalPaise > settings.codMaxOrderPaise) return false;
  return true;
}
