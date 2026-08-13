import Link from "next/link";
import { OrderStatus, PaymentStatus, ReviewStatus, EnquiryStatus } from "@prisma/client";
import { ArrowUpRight, PackageOpen, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatPaise, formatDateTime } from "@/lib/format";
import { AdminStatusChip } from "@/components/admin/ui";
import { integrations } from "@/lib/env";

export const dynamic = "force-dynamic";

const LOW_STOCK_AT = 10;

/** Statuses that count as real, revenue-bearing orders. */
const REVENUE_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PACKED,
  OrderStatus.SHIPPED,
  OrderStatus.IN_TRANSIT,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

export default async function AdminDashboard() {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(dayStart);
  weekStart.setDate(weekStart.getDate() - 6);

  const [today, week, pendingOrders, lowStock, recentOrders, pendingReviews, newEnquiries, subscriberCount] =
    await Promise.all([
      prisma.order.aggregate({
        where: { status: { in: REVENUE_STATUSES }, placedAt: { gte: dayStart } },
        _sum: { totalPaise: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { status: { in: REVENUE_STATUSES }, placedAt: { gte: weekStart } },
        _sum: { totalPaise: true },
        _count: true,
      }),
      prisma.order.count({ where: { status: OrderStatus.CONFIRMED } }),
      prisma.variant.findMany({
        where: { isActive: true, stock: { lt: LOW_STOCK_AT }, product: { isActive: true } },
        orderBy: { stock: "asc" },
        take: 8,
        select: {
          id: true,
          size: true,
          sku: true,
          stock: true,
          product: { select: { name: true, id: true } },
        },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentMethod: true,
          paymentStatus: true,
          totalPaise: true,
          shipCity: true,
          createdAt: true,
        },
      }),
      prisma.review.count({ where: { status: ReviewStatus.PENDING } }),
      prisma.enquiry.count({ where: { status: EnquiryStatus.NEW } }),
      prisma.newsletterSubscriber.count(),
    ]);

  const mocks = [
    !integrations.razorpay && "Razorpay",
    !integrations.delhivery && "Delhivery",
    !integrations.resend && "Email",
    !integrations.cloudinary && "Image upload",
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="micro-label-gold">Back of house</p>
          <h1 className="mt-2 font-display text-4xl font-light text-bone">Dashboard</h1>
        </div>
        <p className="font-sans text-xs text-stone-dark">{formatDateTime(now)}</p>
      </header>

      {mocks.length > 0 && (
        <p className="mt-6 border border-warning/40 bg-warning/[0.06] px-4 py-3 font-sans text-xs leading-relaxed text-warning">
          Running in mock mode: {mocks.join(", ")}. Add the corresponding keys in
          .env to go live — see the README.
        </p>
      )}

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenue today" value={formatPaise(today._sum.totalPaise ?? 0)} sub={`${today._count} order${today._count === 1 ? "" : "s"}`} />
        <Stat label="Revenue, 7 days" value={formatPaise(week._sum.totalPaise ?? 0)} sub={`${week._count} order${week._count === 1 ? "" : "s"}`} />
        <Stat
          label="Awaiting dispatch"
          value={String(pendingOrders)}
          sub="confirmed orders"
          href="/admin/orders?status=CONFIRMED"
          urgent={pendingOrders > 0}
        />
        <Stat label="Newsletter" value={String(subscriberCount)} sub="subscribers" href="/admin/newsletter" />
      </div>

      {/* Work queue */}
      {(pendingReviews > 0 || newEnquiries > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {pendingReviews > 0 && (
            <QueueCard href="/admin/reviews" label={`${pendingReviews} review${pendingReviews === 1 ? "" : "s"} awaiting moderation`} />
          )}
          {newEnquiries > 0 && (
            <QueueCard href="/admin/enquiries" label={`${newEnquiries} unanswered enquir${newEnquiries === 1 ? "y" : "ies"}`} />
          )}
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-5">
        {/* Recent orders */}
        <section className="lg:col-span-3" aria-labelledby="recent-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="recent-heading" className="font-sans text-sm uppercase tracking-wide2 text-bone">
              Recent orders
            </h2>
            <Link href="/admin/orders" className="font-sans text-[0.6875rem] uppercase tracking-label text-gold hover:text-gold-light">
              All orders
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <EmptyPanel icon={<PackageOpen className="h-5 w-5" strokeWidth={1.3} />} text="Orders land here the moment they're placed." />
          ) : (
            <ul className="mt-4 divide-y divide-line border border-line">
              {recentOrders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface"
                  >
                    <span className="w-28 shrink-0 font-sans text-xs text-bone">{o.orderNumber}</span>
                    <AdminStatusChip status={o.status} />
                    <span className="hidden font-sans text-xs text-stone-dark sm:inline">
                      {o.paymentMethod === "COD" ? "COD" : o.paymentStatus === PaymentStatus.PAID ? "Paid" : "Unpaid"}
                    </span>
                    <span className="ml-auto hidden font-sans text-xs text-stone sm:inline">{o.shipCity}</span>
                    <span className="w-20 shrink-0 text-right font-sans text-xs tabular-nums text-bone">
                      {formatPaise(o.totalPaise)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Low stock */}
        <section className="lg:col-span-2" aria-labelledby="stock-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="stock-heading" className="font-sans text-sm uppercase tracking-wide2 text-bone">
              Low stock
            </h2>
            <Link href="/admin/products" className="font-sans text-[0.6875rem] uppercase tracking-label text-gold hover:text-gold-light">
              All products
            </Link>
          </div>

          {lowStock.length === 0 ? (
            <EmptyPanel icon={<PackageOpen className="h-5 w-5" strokeWidth={1.3} />} text="Nothing under 10 units. Healthy shelves." />
          ) : (
            <ul className="mt-4 divide-y divide-line border border-line">
              {lowStock.map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/admin/products/${v.product.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface"
                  >
                    <AlertTriangle
                      className={v.stock === 0 ? "h-4 w-4 shrink-0 text-danger" : "h-4 w-4 shrink-0 text-warning"}
                      strokeWidth={1.5}
                    />
                    <span className="min-w-0 flex-1 truncate font-sans text-xs text-bone">
                      {v.product.name} <span className="text-stone-dark">· {v.size}</span>
                    </span>
                    <span className={`shrink-0 font-sans text-xs tabular-nums ${v.stock === 0 ? "text-danger" : "text-warning"}`}>
                      {v.stock === 0 ? "Out" : `${v.stock} left`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  href,
  urgent,
}: {
  label: string;
  value: string;
  sub: string;
  href?: string;
  urgent?: boolean;
}) {
  const inner = (
    <div className={`border p-4 transition-colors ${urgent ? "border-gold/45" : "border-line"} ${href ? "hover:border-gold/45" : ""}`}>
      <p className="flex items-center justify-between font-sans text-[0.625rem] uppercase tracking-label text-stone">
        {label}
        {href && <ArrowUpRight className="h-3 w-3 text-stone-dark" strokeWidth={1.5} />}
      </p>
      <p className="mt-2 font-display text-3xl font-light text-bone">{value}</p>
      <p className="mt-0.5 font-sans text-xs text-stone-dark">{sub}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function QueueCard({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between border border-gold/35 bg-gold/[0.05] px-4 py-3 font-sans text-xs text-gold-light transition-colors hover:border-gold/60"
    >
      {label}
      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
    </Link>
  );
}

function EmptyPanel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-3 border border-line px-6 py-10 text-center">
      <span className="text-stone-dark">{icon}</span>
      <p className="font-sans text-xs leading-relaxed text-stone-dark">{text}</p>
    </div>
  );
}
