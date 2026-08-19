import { OrderStatus, PaymentStatus, ShipmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { trackShipment, createShipment } from "./delhivery";
import { getStoreSettings } from "@/lib/settings";
import {
  sendOrderShippedEmail,
  sendOrderDeliveredEmail,
} from "@/lib/commerce/order-emails";

/**
 * Keeps Shipment rows (and the customer-facing Order Journey) in sync with
 * the courier.
 *
 * Two inputs feed the same tables: polling (this module, called lazily when
 * an order page is viewed and from a cron route) and the Delhivery webhook.
 * Both funnel through applyTracking(), so scan events are deduplicated by
 * the [shipmentId, status, occurredAt] unique key no matter who reports them.
 */

const SYNC_STALENESS_MS = 10 * 60 * 1000;

const TERMINAL: ShipmentStatus[] = [
  ShipmentStatus.DELIVERED,
  ShipmentStatus.RTO,
  ShipmentStatus.CANCELLED,
];

/** Shipment → Order status mapping. Only ever moves an order forward. */
const ORDER_STATUS_FOR: Partial<Record<ShipmentStatus, OrderStatus>> = {
  [ShipmentStatus.PICKUP_PENDING]: OrderStatus.PACKED,
  [ShipmentStatus.IN_TRANSIT]: OrderStatus.IN_TRANSIT,
  [ShipmentStatus.OUT_FOR_DELIVERY]: OrderStatus.OUT_FOR_DELIVERY,
  [ShipmentStatus.DELIVERED]: OrderStatus.DELIVERED,
  [ShipmentStatus.RTO]: OrderStatus.RTO,
};

/** Forward-only guard: a late webhook can't demote a delivered order. */
const ORDER_PROGRESSION: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PACKED,
  OrderStatus.SHIPPED,
  OrderStatus.IN_TRANSIT,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

function isForward(from: OrderStatus, to: OrderStatus) {
  const a = ORDER_PROGRESSION.indexOf(from);
  const b = ORDER_PROGRESSION.indexOf(to);
  // Statuses outside the linear journey (cancel/return/RTO) always apply.
  if (b === -1) return true;
  if (a === -1) return false;
  return b > a;
}

export type TrackingUpdate = {
  status: ShipmentStatus;
  statusDetail: string | null;
  expectedDeliveryAt?: Date | null;
  scans: { status: string; detail: string | null; location: string | null; occurredAt: Date }[];
  raw?: unknown;
};

/** Writes one tracking snapshot into Shipment + events + Order. */
export async function applyTracking(shipmentId: string, update: TrackingUpdate) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      status: true,
      orderId: true,
      order: {
        select: {
          id: true,
          status: true,
          deliveredAt: true,
          paymentMethod: true,
          paymentStatus: true,
        },
      },
    },
  });
  if (!shipment) return;

  await prisma.$transaction(async (tx) => {
    await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status: update.status,
        statusDetail: update.statusDetail,
        expectedDeliveryAt: update.expectedDeliveryAt ?? undefined,
        lastSyncedAt: new Date(),
        deliveredAt: update.status === ShipmentStatus.DELIVERED ? new Date() : undefined,
        raw: update.raw ? (update.raw as Prisma.InputJsonValue) : undefined,
      },
    });

    for (const scan of update.scans) {
      await tx.shipmentEvent
        .create({
          data: {
            shipmentId: shipment.id,
            status: scan.status,
            detail: scan.detail,
            location: scan.location,
            occurredAt: scan.occurredAt,
          },
        })
        .catch((err) => {
          // Duplicate scan (same status at the same instant) — already recorded.
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"))
            throw err;
        });
    }

    const nextOrderStatus = ORDER_STATUS_FOR[update.status];
    if (nextOrderStatus && isForward(shipment.order.status, nextOrderStatus)) {
      await tx.order.update({
        where: { id: shipment.order.id },
        data: {
          status: nextOrderStatus,
          deliveredAt:
            nextOrderStatus === OrderStatus.DELIVERED && !shipment.order.deliveredAt
              ? new Date()
              : undefined,
          /*
            A delivered COD order has been paid — in cash, at the door.

            The admin's manual "mark delivered" already applied this rule
            (actions/admin/orders.ts), but the courier-driven path did not. So
            every order that completed the way it is SUPPOSED to — automatically,
            from a Delhivery scan — stayed PENDING forever, while the ones a
            human clicked through were marked paid. COD revenue silently
            under-reported on the dashboard in exact proportion to how well the
            automation was working.

            Guarded on the current value so a refund recorded earlier is not
            overwritten by a late delivery scan.
          */
          paymentStatus:
            nextOrderStatus === OrderStatus.DELIVERED &&
            shipment.order.paymentMethod === "COD" &&
            shipment.order.paymentStatus === PaymentStatus.PENDING
              ? PaymentStatus.PAID
              : undefined,
        },
      });
    }
  });

  // Delivered email exactly once — keyed on the order's deliveredAt being
  // set by THIS transition.
  if (
    update.status === ShipmentStatus.DELIVERED &&
    !shipment.order.deliveredAt &&
    shipment.order.status !== OrderStatus.DELIVERED
  ) {
    const order = await prisma.order.findUnique({
      where: { id: shipment.order.id },
      include: { items: true },
    });
    if (order) {
      await sendOrderDeliveredEmail({
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
      }).catch((err) => console.error("[shipping] delivered email failed:", err));
    }
  }
}

/**
 * Refreshes tracking for an order if it's stale. Lazy sync: called when an
 * order page is viewed, so customers see live data without any cron running.
 */
export async function syncOrderTracking(orderId: string, opts: { force?: boolean } = {}) {
  const shipment = await prisma.shipment.findUnique({
    where: { orderId },
    select: { id: true, waybill: true, status: true, lastSyncedAt: true, shippedAt: true },
  });

  if (!shipment?.waybill) return;
  if (TERMINAL.includes(shipment.status)) return;
  if (
    !opts.force &&
    shipment.lastSyncedAt &&
    Date.now() - shipment.lastSyncedAt.getTime() < SYNC_STALENESS_MS
  ) {
    return;
  }

  try {
    const tracking = await trackShipment(shipment.waybill, { shippedAt: shipment.shippedAt });
    await applyTracking(shipment.id, {
      status: ShipmentStatus[tracking.status],
      statusDetail: tracking.statusDetail,
      expectedDeliveryAt: tracking.expectedDeliveryAt,
      scans: tracking.scans,
    });
  } catch (err) {
    console.error(`[shipping] tracking sync for order ${orderId} failed:`, err);
    // Stamp the attempt so a dead courier API doesn't get hammered on every
    // page view.
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { lastSyncedAt: new Date() },
    });
  }
}

/**
 * Creates the Delhivery shipment for a confirmed order (admin action).
 * Issues the AWB, marks the order PACKED, and sends the shipped email.
 */
export async function createOrderShipment(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { variant: { select: { weightGrams: true } } } },
      shipment: true,
    },
  });

  if (!order) throw new Error("Order not found.");
  if (order.shipment?.waybill) return order.shipment; // idempotent
  if (
    order.status !== OrderStatus.CONFIRMED &&
    order.status !== OrderStatus.PACKED
  ) {
    throw new Error(`A shipment can't be created for a ${order.status} order.`);
  }

  const settings = await getStoreSettings();

  const weightGrams = order.items.reduce(
    (n, i) => n + (i.variant?.weightGrams ?? 250) * i.quantity,
    0,
  );

  const created = await createShipment({
    orderNumber: order.orderNumber,
    // Admin → Settings → "Pickup location name". This field was previously
    // stored and editable but never read, so changing it in the panel had no
    // effect and shipments silently used the env var instead.
    pickupName: settings.delhiveryPickupName,
    paymentMode: order.paymentMethod === "COD" ? "COD" : "Prepaid",
    codAmountPaise: order.paymentMethod === "COD" ? order.totalPaise : 0,
    totalPaise: order.totalPaise,
    weightGrams,
    productsDescription: order.items
      .map((i) => `${i.productName} ${i.variantSize} x${i.quantity}`)
      .join(", "),
    consignee: {
      name: order.shipName,
      phone: order.shipPhone,
      line1: order.shipLine1,
      line2: order.shipLine2,
      city: order.shipCity,
      state: order.shipState,
      pincode: order.shipPincode,
    },
  });

  const shipment = await prisma.$transaction(async (tx) => {
    const row = order.shipment
      ? await tx.shipment.update({
          where: { id: order.shipment.id },
          data: {
            waybill: created.waybill,
            status: ShipmentStatus.PICKUP_PENDING,
            courierName: "Delhivery",
            trackingUrl: `https://www.delhivery.com/track/package/${created.waybill}`,
            shippedAt: new Date(),
            raw: created.raw as Prisma.InputJsonValue,
          },
        })
      : await tx.shipment.create({
          data: {
            orderId: order.id,
            waybill: created.waybill,
            status: ShipmentStatus.PICKUP_PENDING,
            courierName: "Delhivery",
            trackingUrl: `https://www.delhivery.com/track/package/${created.waybill}`,
            shippedAt: new Date(),
            raw: created.raw as Prisma.InputJsonValue,
          },
        });

    if (isForward(order.status, OrderStatus.PACKED)) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PACKED },
      });
    }

    return row;
  });

  await sendOrderShippedEmail(
    {
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
    },
    { waybill: created.waybill, courier: "Delhivery" },
  ).catch((err) => console.error("[shipping] shipped email failed:", err));

  return shipment;
}
