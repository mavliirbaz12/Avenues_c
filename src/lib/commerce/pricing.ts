import { CouponType, PaymentMethod } from "@prisma/client";
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
  | { status: "applied"; code: string; couponId: string; discountPaise: number; label: string }
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
  subtotalPaise: number;
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

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    return { status: "rejected", code, message: "That code isn't active yet." };
  }
  if (coupon.endsAt && coupon.endsAt < now) {
    return { status: "rejected", code, message: "That code has expired." };
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { status: "rejected", code, message: "That code has been fully claimed." };
  }
  if (args.subtotalPaise < coupon.minOrderPaise) {
    const short = (coupon.minOrderPaise - args.subtotalPaise) / 100;
    return {
      status: "rejected",
      code,
      message: `Spend ₹${short.toLocaleString("en-IN")} more to use this code.`,
    };
  }

  if (coupon.perUserLimit !== null && args.userId) {
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

  return { status: "applied", code, couponId: coupon.id, discountPaise, label };
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

  const coupon = opts.couponCode
    ? await evaluateCoupon({ code: opts.couponCode, subtotalPaise, userId: opts.userId })
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
