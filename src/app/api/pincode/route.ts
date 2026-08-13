import { NextResponse, type NextRequest } from "next/server";
import { checkPincode } from "@/lib/shipping/delhivery";
import { limitByIp } from "@/lib/rate-limit";
import { PINCODE_REGEX } from "@/lib/constants/india";

export const dynamic = "force-dynamic";

/** Pincode serviceability for the checkout form. */
export async function GET(req: NextRequest) {
  const pin = (req.nextUrl.searchParams.get("pin") ?? "").trim();

  if (!PINCODE_REGEX.test(pin)) {
    return NextResponse.json(
      { serviceable: false, codAvailable: false, city: null, state: null, invalid: true },
      { status: 400 },
    );
  }

  const limit = await limitByIp("pincode", 30, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }

  const result = await checkPincode(pin);
  return NextResponse.json(result);
}
