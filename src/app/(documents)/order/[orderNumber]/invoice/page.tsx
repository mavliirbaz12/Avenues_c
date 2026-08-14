import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth-guards";
import { verifyOrderAccessToken } from "@/lib/commerce/order-token";
import { InvoiceSheet } from "@/components/orders/invoice-sheet";

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Customer door to the invoice — same access rule as the order page itself:
 * the signed-in owner, or a bearer of the HMAC token from the confirmation
 * email. Renders only once an invoice number exists (i.e. the order is
 * confirmed); a PENDING checkout has no invoice to show.
 *
 * Lives in the (documents) route group, NOT (store), so the site nav and
 * footer never print around the invoice sheet. Route groups don't affect the
 * URL — this is still /order/[orderNumber]/invoice.
 */
export default async function CustomerInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orderNumber } = await params;
  const sp = await searchParams;
  const token = (Array.isArray(sp.t) ? sp.t[0] : sp.t) ?? null;

  const order = await prisma.order.findUnique({
    where: { orderNumber: orderNumber.toUpperCase() },
    include: { items: true },
  });
  if (!order) notFound();

  const user = await getCurrentUser();
  const isOwner = Boolean(user && order.userId === user.id);
  if (!isOwner && !verifyOrderAccessToken(order.id, token)) {
    redirect(`/track?order=${encodeURIComponent(order.orderNumber)}`);
  }

  if (!order.invoiceNumber) {
    redirect(`/order/${order.orderNumber}${token ? `?t=${token}` : ""}`);
  }

  const settings = await getStoreSettings();

  return <InvoiceSheet order={order} settings={settings} />;
}
