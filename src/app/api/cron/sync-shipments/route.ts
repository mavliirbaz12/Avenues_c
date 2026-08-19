import { NextResponse, type NextRequest } from "next/server";
import { ShipmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { syncOrderTracking } from "@/lib/shipping/sync";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Pulls fresh scans for every shipment still in flight.
 *
 * WHY THIS EXISTS. Tracking normally advances on its own: Delhivery pushes to
 * /api/webhooks/delhivery, and a customer opening their order page triggers a
 * sync. Both have gaps. The push needs DELHIVERY_WEBHOOK_SECRET configured and
 * the URL registered with Delhivery — until that is done, nothing arrives at
 * all — and the page-view sync only fires for orders somebody is actively
 * watching. An order placed and then ignored can sit on a stale status right
 * through to delivery, which is exactly the order whose customer is most
 * likely to ask where their parcel is.
 *
 * This is a floor under both, not a replacement for either.
 *
 * ONCE A DAY, deliberately. Hobby plans cap cron at a single daily run with
 * ±59 minutes of slop (the earlier every-15-minutes schedule is
 * exactly what made the previous vercel.json fail to deploy). So this is a safety net that guarantees every
 * live shipment is refreshed at least daily; the webhook remains the mechanism
 * that makes tracking feel live. Moving to Pro allows a per-minute schedule
 * without touching this file.
 *
 * `force: true` because the daily cadence is already far longer than the
 * 10-minute staleness window syncOrderTracking would otherwise apply — without
 * it, a shipment synced by a page view minutes earlier would be skipped and
 * wait another day.
 */
export async function GET(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");

  // Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. The AUTH_SECRET
  // fallback keeps the route from ever being unauthenticated, but note that
  // Vercel only sends the header when CRON_SECRET is set — leave it unset and
  // the platform's own invocation is the thing that gets a 401.
  const expected = process.env.CRON_SECRET || env.AUTH_SECRET;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  // Anything not yet in a terminal state. A shipment with no waybill has not
  // been booked, so there is nothing to ask about.
  const live = await prisma.shipment.findMany({
    where: {
      waybill: { not: null },
      status: {
        notIn: [ShipmentStatus.DELIVERED, ShipmentStatus.RTO, ShipmentStatus.CANCELLED],
      },
    },
    select: { orderId: true },
    // A bound rather than a page: a backlog this size means something else is
    // wrong, and a cron run that never finishes helps nobody.
    take: 200,
  });

  let synced = 0;
  let failed = 0;

  // Serial on purpose. Delhivery rate-limits, and this has a whole day to
  // finish — parallelising it buys nothing and risks 429s that would leave
  // shipments unsynced until tomorrow.
  for (const { orderId } of live) {
    try {
      await syncOrderTracking(orderId, { force: true });
      synced += 1;
    } catch (err) {
      failed += 1;
      console.error(`[cron:sync-shipments] ${orderId} failed:`, err);
    }
  }

  return NextResponse.json({ ok: true, considered: live.length, synced, failed });
}
