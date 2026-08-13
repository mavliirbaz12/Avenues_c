import { NextResponse, type NextRequest } from "next/server";
import { releaseExpiredReservations } from "@/lib/commerce/orders";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Frees inventory reserved by prepaid orders whose payment window lapsed.
 *
 * The same routine also runs opportunistically at every order creation, so
 * this endpoint is a safety net rather than a load-bearing dependency — a
 * shop with no traffic has no stuck stock to release. Wire it to Vercel Cron
 * (vercel.json) or any scheduler; see README.
 *
 * Authenticated with a bearer check against AUTH_SECRET so strangers can't
 * hammer the release path.
 */
export async function GET(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");

  // Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` when the env var
  // exists; we reuse AUTH_SECRET rather than introducing another secret.
  if (token !== env.AUTH_SECRET) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const released = await releaseExpiredReservations();
  return NextResponse.json({ ok: true, released });
}
