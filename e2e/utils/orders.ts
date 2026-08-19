import { request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { db } from "./db";
import { STORAGE, TEST_BASE_URL } from "./env";

/**
 * Places an order through the real POST /api/checkout.
 *
 * Used by specs that need an order to exist (account history, admin lists,
 * cancellation) without driving the whole checkout UI first. The UI path is
 * covered separately in checkout.spec.ts — this is for arranging state, and it
 * still exercises the real pricing, stock and order-creation code rather than
 * inserting rows behind the app's back.
 */

export const TEST_ADDRESS = {
  fullName: "Test Customer",
  phone: "9812345670",
  line1: "12 Carter Road",
  line2: "Bandra West",
  landmark: "Opposite the bakery",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400050",
} as const;

/** A pincode the mock Delhivery client always reports as unserviceable. */
export const UNSERVICEABLE_PINCODE = "999999";

/**
 * Guarantees a product has stock before a spec spends it.
 *
 * Order specs consume inventory, and the oversell test deliberately drives a
 * variant to zero. Without this, spec order and previous runs decide whether a
 * later test can buy anything — the classic way an E2E suite becomes
 * "sometimes red".
 */
export async function ensureStock(slug: string, stock = 50) {
  const variant = await db.variant.findFirst({
    where: { product: { slug } },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  if (!variant) throw new Error(`No variant for ${slug}`);
  return db.variant.update({
    where: { id: variant.id },
    data: { stock, isActive: true },
    select: { id: true, pricePaise: true, stock: true, productId: true },
  });
}

export async function firstSellableVariant(slug?: string) {
  return db.variant.findFirst({
    where: {
      isActive: true,
      stock: { gt: 0 },
      ...(slug ? { product: { slug } } : { product: { isActive: true } }),
    },
    select: { id: true, pricePaise: true, stock: true, productId: true },
  });
}

let ipCounter = 0;

/**
 * A distinct client IP per simulated buyer.
 *
 * /api/checkout allows 10 orders per IP per five minutes, and this suite
 * places far more than that. Rather than weakening the limit for tests — it is
 * exactly the kind of protection worth keeping honest — each order arrives
 * from its own address via X-Forwarded-For, which is what `clientIp()` reads.
 * It also makes the oversell race truthful: two different buyers, not one
 * customer double-clicking.
 */
export function nextClientIp() {
  ipCounter += 1;
  return `203.0.113.${(ipCounter % 250) + 1}`;
}

/**
 * An API context carrying the signed-in customer's session.
 *
 * Checkout requires an account, so the bare `request` fixture — which is a
 * guest — now gets a 401 from /api/checkout. Specs that merely need an order to
 * *exist* shouldn't have to care, so this helper signs in for them by reusing
 * the storage state the setup project already wrote. Specs that are actually
 * about the signed-out case pass `guest: true` and assert the 401 themselves.
 */
export async function customerRequest() {
  return playwrightRequest.newContext({
    baseURL: TEST_BASE_URL,
    storageState: STORAGE.customer,
  });
}

export async function placeOrder(
  request: APIRequestContext,
  opts: {
    variantId: string;
    quantity?: number;
    paymentMethod?: "COD" | "RAZORPAY";
    email?: string;
    phone?: string;
    couponCode?: string | null;
    /** Override to make two calls share, or deliberately not share, a bucket. */
    clientIp?: string;
    /** Post signed-out, to assert checkout refuses a guest. */
    guest?: boolean;
    /**
     * Set false when the spec is asserting a REFUSAL (401, 409, out of stock).
     * Defaults true: most callers just need an order to exist and go straight
     * on to use `body.orderNumber`.
     */
    expectOk?: boolean;
  },
) {
  // Sign in unless the spec is specifically testing the signed-out path.
  const ctx = opts.guest ? null : await customerRequest();
  const api = ctx ?? request;
  try {
    const result = await post(api, opts);

    /*
      Fail HERE, with the server's own words, when the order did not happen.

      Callers destructure `body.orderNumber` and hand it straight to Prisma. So
      a refused checkout surfaced as `orderNumber: undefined` inside a
      `db.order.update()` several lines later, and the reported error was a
      PrismaClientValidationError listing every valid `where` key — which says
      nothing about the 401 or the sold-out variant that actually caused it.
      Three separate specs were failing that way and none of them named the
      real reason.
    */
    const expectOk = opts.expectOk ?? !opts.guest;
    if (expectOk && (result.status >= 400 || !result.body?.orderNumber)) {
      throw new Error(
        `placeOrder expected an order, got HTTP ${result.status}: ${JSON.stringify(result.body)}`,
      );
    }
    return result;
  } finally {
    await ctx?.dispose();
  }
}

async function post(
  request: APIRequestContext,
  opts: Parameters<typeof placeOrder>[1],
) {
  const res = await request.post("/api/checkout", {
    headers: { "x-forwarded-for": opts.clientIp ?? nextClientIp() },
    data: {
      items: [{ variantId: opts.variantId, quantity: opts.quantity ?? 1 }],
      email: opts.email ?? "customer@test.dev",
      phone: opts.phone ?? TEST_ADDRESS.phone,
      paymentMethod: opts.paymentMethod ?? "COD",
      couponCode: opts.couponCode ?? null,
      termsAccepted: true,
      address: TEST_ADDRESS,
      saveToBook: false,
    },
  });

  return { status: res.status(), body: await res.json().catch(() => null) };
}
