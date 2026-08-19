import { notFound } from "next/navigation";
import { mockPaymentsAllowed } from "@/lib/payments/razorpay";
import { MockPayClient } from "./mock-pay-client";

/**
 * Server wrapper around the mock gateway.
 *
 * The simulator itself has to be a client component, which means it cannot
 * check anything itself — so this exists purely to refuse to render it, and to
 * stop the mock sentinels shipping to a browser, anywhere mock payments are not
 * permitted. See mockPaymentsAllowed in lib/payments/razorpay.ts.
 *
 * Deliberately a page-level guard rather than a layout: a layout can be skipped
 * by a crafted RSC request, which is exactly how the admin panel was leaking.
 */
export default async function MockPayPage() {
  if (!mockPaymentsAllowed) notFound();
  return <MockPayClient />;
}
