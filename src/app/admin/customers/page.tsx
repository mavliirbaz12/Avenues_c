import Link from "next/link";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPaise, formatDate } from "@/lib/format";
import { AdminPageHeader, AdminChip } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const REVENUE_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PACKED,
  OrderStatus.SHIPPED,
  OrderStatus.IN_TRANSIT,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = ((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "").trim();

  const customers = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      ...(q
        ? {
            OR: [
              { email: { contains: q.toLowerCase() } },
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q.replace(/\D/g, "").slice(-10) || q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      orders: {
        where: { status: { in: REVENUE_STATUSES } },
        select: { totalPaise: true },
      },
      _count: { select: { reviews: true } },
    },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader title="Customers">
        <p className="mt-2 font-sans text-xs text-stone">
          Registered accounts. Guest buyers appear once they sign up with the
          same email — their orders attach automatically.
        </p>
      </AdminPageHeader>

      <form action="/admin/customers" className="mt-6">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name, email or phone"
          className="field w-72 py-2 text-xs"
        />
      </form>

      {customers.length === 0 ? (
        <p className="mt-6 border border-line px-6 py-12 text-center font-sans text-sm text-stone-dark">
          {q ? "No customers match that search." : "No registered customers yet."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto border border-line">
          <table className="w-full min-w-[44rem] border-collapse font-sans text-xs">
            <thead>
              <tr className="border-b border-line text-left">
                <Th>Customer</Th>
                <Th>Joined</Th>
                <Th className="text-right">Orders</Th>
                <Th className="text-right">Lifetime value</Th>
                <Th className="text-right">Reviews</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {customers.map((c) => {
                const orderCount = c.orders.length;
                const lifetime = c.orders.reduce((n, o) => n + o.totalPaise, 0);
                return (
                  <tr key={c.id} className="group relative transition-colors hover:bg-surface">
                    <td className="px-4 py-3">
                      <Link href={`/admin/customers/${c.id}`} className="after:absolute after:inset-0">
                        <span className="block text-bone">{c.name ?? "—"}</span>
                        <span className="block text-stone-dark">
                          {c.email ?? "phone-only"}
                          {c.phone && ` · ${c.phone}`}
                        </span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-stone-dark">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-stone">{orderCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-bone">{formatPaise(lifetime)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-stone-dark">{c._count.reviews}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("px-4 py-3 font-sans text-[0.625rem] font-normal uppercase tracking-label text-stone-dark", className)}>
      {children}
    </th>
  );
}
