import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatPaise, formatDate, formatDateTime } from "@/lib/format";
import { AdminPageHeader, AdminStatusChip, AdminChip } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const customer = await prisma.user.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalPaise: true,
          createdAt: true,
          paymentMethod: true,
        },
      },
      addresses: { orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] },
    },
  });
  if (!customer || customer.role !== "CUSTOMER") notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/customers" className="inline-flex items-center gap-2 font-sans text-[0.6875rem] uppercase tracking-label text-stone transition-colors hover:text-gold-light">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.6} />
        Customers
      </Link>

      <div className="mt-4">
        <AdminPageHeader
          title={customer.name ?? customer.email ?? `+91 ${customer.phone ?? ""}`.trim()}
        >
          <p className="mt-2 font-sans text-xs text-stone">
            {customer.email ? (
              <a href={`mailto:${customer.email}`} className="hover:text-gold-light">
                {customer.email}
              </a>
            ) : (
              <span className="text-stone-dark">Phone-OTP account, no email yet</span>
            )}
            {customer.phone && (
              <>
                {" · "}
                <a href={`tel:${customer.phone}`} className="hover:text-gold-light">
                  {customer.phone}
                </a>
              </>
            )}
            {" · joined "}
            {formatDate(customer.createdAt)}
          </p>
        </AdminPageHeader>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <h2 className="font-sans text-xs uppercase tracking-wide2 text-bone">Orders</h2>
          {customer.orders.length === 0 ? (
            <p className="mt-3 border border-line px-4 py-8 text-center font-sans text-xs text-stone-dark">
              No orders on this account yet.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line border border-line">
              {customer.orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-4 px-4 py-3 font-sans text-xs transition-colors hover:bg-surface">
                    <span className="w-28 text-bone">{o.orderNumber}</span>
                    <AdminStatusChip status={o.status} />
                    <span className="text-stone-dark">{o.paymentMethod}</span>
                    <span className="ml-auto text-stone-dark">{formatDateTime(o.createdAt)}</span>
                    <span className="w-20 text-right tabular-nums text-bone">{formatPaise(o.totalPaise)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-2">
          <h2 className="font-sans text-xs uppercase tracking-wide2 text-bone">Addresses</h2>
          {customer.addresses.length === 0 ? (
            <p className="mt-3 border border-line px-4 py-8 text-center font-sans text-xs text-stone-dark">
              No saved addresses.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {customer.addresses.map((a) => (
                <li key={a.id} className="border border-line p-4 font-sans text-xs leading-relaxed text-stone">
                  <p className="flex items-center gap-2 text-bone">
                    {a.fullName}
                    {a.isDefault && <AdminChip tone="gold">Default</AdminChip>}
                  </p>
                  <address className="mt-1 not-italic text-stone-dark">
                    {a.line1}
                    {a.line2 && <>, {a.line2}</>}
                    <br />
                    {a.city}, {a.state} {a.pincode}
                    <br />
                    {a.phone}
                  </address>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
