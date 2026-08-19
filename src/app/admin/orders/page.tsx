import Link from "next/link";
import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPaise, formatDateTime } from "@/lib/format";
import { AdminPageHeader, AdminStatusChip } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth-guards";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

const FILTERS: { value: string; label: string; where: Prisma.OrderWhereInput }[] = [
  { value: "", label: "All", where: {} },
  { value: "action", label: "Needs action", where: { status: { in: [OrderStatus.CONFIRMED, OrderStatus.RETURN_REQUESTED] } } },
  { value: "CONFIRMED", label: "To dispatch", where: { status: OrderStatus.CONFIRMED } },
  { value: "in-flight", label: "In flight", where: { status: { in: [OrderStatus.PACKED, OrderStatus.SHIPPED, OrderStatus.IN_TRANSIT, OrderStatus.OUT_FOR_DELIVERY] } } },
  { value: "DELIVERED", label: "Delivered", where: { status: OrderStatus.DELIVERED } },
  { value: "COD", label: "COD", where: { paymentMethod: "COD" } },
  { value: "problem", label: "Problems", where: { status: { in: [OrderStatus.CANCELLED, OrderStatus.RTO, OrderStatus.FAILED, OrderStatus.RETURN_REQUESTED, OrderStatus.RETURNED] } } },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const sp = await searchParams;
  const one = (k: string) => ((Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "").trim();

  const q = one("q");
  const filter = FILTERS.find((f) => f.value === one("status")) ?? FILTERS[0]!;
  const page = Math.max(1, Number(one("page")) || 1);

  const where: Prisma.OrderWhereInput = {
    ...filter.where,
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q.toUpperCase() } },
            { email: { contains: q.toLowerCase() } },
            { phone: { contains: q.replace(/\D/g, "").slice(-10) || q } },
            { shipName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        totalPaise: true,
        email: true,
        shipName: true,
        shipCity: true,
        createdAt: true,
        shipment: { select: { waybill: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (patch: Record<string, string>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filter.value) params.set("status", filter.value);
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const s = params.toString();
    return s ? `/admin/orders?${s}` : "/admin/orders";
  };

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader title="Orders">
        <p className="mt-2 font-sans text-xs text-stone">
          {total} order{total === 1 ? "" : "s"}
          {q && <> matching &ldquo;{q}&rdquo;</>}
        </p>
      </AdminPageHeader>

      {/* Filters + search */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={qs({ status: f.value, page: "" })}
            className={cn(
              "border px-3 py-1.5 font-sans text-[0.6875rem] uppercase tracking-wide2 transition-colors",
              f.value === filter.value
                ? "border-gold/60 bg-gold/10 text-gold-light"
                : "border-line text-stone hover:border-line-strong hover:text-bone",
            )}
          >
            {f.label}
          </Link>
        ))}

        <form action="/admin/orders" className="ml-auto flex items-center gap-2">
          {filter.value && <input type="hidden" name="status" value={filter.value} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Order no., email, phone, name"
            className="field w-64 py-2 text-xs"
          />
        </form>
      </div>

      {/* Table */}
      {orders.length === 0 ? (
        <p className="mt-8 border border-line px-6 py-12 text-center font-sans text-sm text-stone-dark">
          Nothing here under this filter.
        </p>
      ) : (
        <>
        {/*
          Phones get cards, not a sideways scroller.

          The table below is 56rem wide — on a 390px screen that is a viewport
          and a half of horizontal dragging to reach the total, with the header
          row scrolled off so you cannot tell which column you are looking at.
          It technically worked, which is why it survived; it was not usable
          while standing at a packing table holding a phone.

          Same data, same order, stacked per record. The table is kept intact
          for `sm` and up, where columns genuinely are the better scan.
        */}
        <ul className="mt-6 space-y-3 sm:hidden">
          {orders.map((o) => (
            <li key={o.id} className="relative border border-line px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="font-sans text-sm font-medium text-bone after:absolute after:inset-0"
                >
                  {o.orderNumber}
                </Link>
                <span className="font-sans text-sm tabular-nums text-bone">
                  {formatPaise(o.totalPaise)}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <AdminStatusChip status={o.status} />
                <span className="font-sans text-[0.6875rem] text-stone">
                  {o.paymentMethod === "COD"
                    ? o.paymentStatus === PaymentStatus.PAID ? "COD · collected" : "COD"
                    : o.paymentStatus === PaymentStatus.PAID ? "Paid"
                    : o.paymentStatus === PaymentStatus.REFUNDED ? "Refunded"
                    : "Unpaid"}
                </span>
              </div>

              <p className="mt-2 font-sans text-xs text-stone">
                {o.shipName} · {o.shipCity}
              </p>
              <p className="mt-1 font-sans text-[0.6875rem] text-stone-dark">
                {formatDateTime(o.createdAt)}
                {o.shipment?.waybill ? ` · AWB ${o.shipment.waybill}` : ""}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-6 hidden overflow-x-auto border border-line sm:block">
          <table className="w-full min-w-[56rem] border-collapse font-sans text-xs">
            <thead>
              <tr className="border-b border-line text-left">
                <Th>Order</Th>
                <Th>Placed</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th>AWB</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.id} className="group relative transition-colors hover:bg-surface">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${o.id}`} className="font-medium text-bone after:absolute after:inset-0">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-stone-dark">{formatDateTime(o.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className="block text-stone">{o.shipName}</span>
                    <span className="block text-stone-dark">{o.shipCity}</span>
                  </td>
                  <td className="px-4 py-3"><AdminStatusChip status={o.status} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-stone">
                    {o.paymentMethod === "COD"
                      ? o.paymentStatus === PaymentStatus.PAID ? "COD · collected" : "COD"
                      : o.paymentStatus === PaymentStatus.PAID ? "Paid"
                      : o.paymentStatus === PaymentStatus.REFUNDED ? "Refunded"
                      : "Unpaid"}
                  </td>
                  <td className="px-4 py-3 text-stone-dark">{o.shipment?.waybill ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-bone">{formatPaise(o.totalPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-between font-sans text-xs text-stone" aria-label="Pagination">
          <span>Page {page} of {pages}</span>
          <span className="flex gap-2">
            {page > 1 && <Link href={qs({ page: String(page - 1) })} className="btn btn-ghost btn-sm">Newer</Link>}
            {page < pages && <Link href={qs({ page: String(page + 1) })} className="btn btn-ghost btn-sm">Older</Link>}
          </span>
        </nav>
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
