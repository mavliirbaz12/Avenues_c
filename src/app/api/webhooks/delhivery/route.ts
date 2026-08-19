import { NextResponse, type NextRequest } from "next/server";
import { ShipmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyTracking } from "@/lib/shipping/sync";
import { normaliseDelhiveryStatus } from "@/lib/shipping/delhivery";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Delhivery tracking push.
 *
 * Authenticated by a shared-secret query token (?token=...) configured on
 * both sides — Delhivery's push doesn't sign bodies the way Razorpay does.
 * Payload shapes vary by account configuration, so parsing is defensive:
 * we accept their documented Shipment wrapper and a flat variant, extract
 * (waybill, status, location, timestamp), and funnel into the same
 * applyTracking() path the poller uses. Unknown waybills are acknowledged
 * and ignored.
 */
export async function POST(req: NextRequest) {
  if (
    !env.DELHIVERY_WEBHOOK_SECRET ||
    req.nextUrl.searchParams.get("token") !== env.DELHIVERY_WEBHOOK_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Malformed body." }, { status: 400 });

  // Documented wrapper: { Shipment: { AWB, Status: { Status, StatusDateTime,
  // StatusLocation, Instructions } } } — with a flat fallback.
  const wrapper = (body.Shipment ?? body.shipment ?? body) as Record<string, unknown>;
  const statusObj = (wrapper.Status ?? wrapper.status ?? {}) as Record<string, unknown>;

  const waybill = String(wrapper.AWB ?? wrapper.awb ?? wrapper.waybill ?? "").trim();
  const statusWord = String(statusObj.Status ?? statusObj.status ?? "").toLowerCase();
  const detail = (statusObj.Instructions ?? statusObj.instructions ?? null) as string | null;
  const location = (statusObj.StatusLocation ?? statusObj.location ?? null) as string | null;
  const at = statusObj.StatusDateTime ?? statusObj.timestamp ?? null;
  const occurredAt = at ? new Date(String(at)) : new Date();

  if (!waybill || !statusWord) {
    return NextResponse.json({ error: "Missing waybill or status." }, { status: 400 });
  }

  const shipment = await prisma.shipment.findUnique({
    where: { waybill },
    select: { id: true },
  });
  // Not ours (or not created yet) — acknowledge so Delhivery doesn't retry.
  if (!shipment) return NextResponse.json({ ok: true, ignored: true });

  // The same mapper the polling path uses. These were two hand-maintained
  // copies that had already drifted; both funnelled NDR scans into IN_TRANSIT,
  // so a failed delivery attempt reached the customer as "Moving through the
  // network". See normaliseDelhiveryStatus.
  const status: ShipmentStatus = ShipmentStatus[normaliseDelhiveryStatus(statusWord)];

  await applyTracking(shipment.id, {
    status,
    statusDetail: detail,
    scans: [
      {
        status: String(statusObj.Status ?? statusWord),
        detail,
        location,
        occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
      },
    ],
    raw: body,
  });

  return NextResponse.json({ ok: true });
}
