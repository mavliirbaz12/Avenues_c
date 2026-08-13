import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { razorpayLive, MOCK_ORDER_PREFIX } from "@/lib/payments/razorpay";
import { markPaymentFailed } from "@/lib/commerce/orders";

export const dynamic = "force-dynamic";

const schema = z.object({ razorpayOrderId: z.string().min(1) });

/**
 * Records a simulated payment failure from the mock gateway page.
 * Hard-disabled the moment real Razorpay keys are configured.
 */
export async function POST(req: NextRequest) {
  if (razorpayLive) {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !parsed.data.razorpayOrderId.startsWith(MOCK_ORDER_PREFIX)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  await markPaymentFailed({
    razorpayOrderId: parsed.data.razorpayOrderId,
    errorCode: "MOCK_FAILURE",
    errorDescription: "Simulated failure from the mock gateway",
  });

  return NextResponse.json({ ok: true });
}
