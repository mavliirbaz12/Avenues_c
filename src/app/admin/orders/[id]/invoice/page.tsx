import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/settings";
import { InvoiceSheet } from "@/components/orders/invoice-sheet";
import { requireAdmin } from "@/lib/auth-guards";

export const dynamic = "force-dynamic";

/** Admin door to the shared invoice sheet. Auth comes from the /admin layout guard. */
export default async function AdminInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;

  const [order, settings] = await Promise.all([
    prisma.order.findUnique({ where: { id }, include: { items: true } }),
    getStoreSettings(),
  ]);
  if (!order || !order.invoiceNumber) notFound();

  return <InvoiceSheet order={order} settings={settings} />;
}
