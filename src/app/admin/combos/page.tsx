import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatPaise } from "@/lib/format";
import { AdminPageHeader, AdminChip } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const LOW_STOCK_AT = 10;

export default async function AdminCombosPage() {
  const combos = await prisma.product.findMany({
    where: { type: "COMBO" },
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      slug: true,
      name: true,
      isActive: true,
      isFeatured: true,
      couponEligible: true,
      variants: { select: { stock: true, pricePaise: true, mrpPaise: true }, take: 1 },
      _count: { select: { comboItems: true } },
    },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Gift sets"
        actions={
          <Link href="/admin/combos/new" className="btn btn-primary btn-sm">
            <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
            New set
          </Link>
        }
      >
        <p className="mt-2 font-sans text-xs text-stone">
          {combos.length} set{combos.length === 1 ? "" : "s"} ·{" "}
          {combos.filter((c) => c.isActive).length} live on the storefront
        </p>
      </AdminPageHeader>

      {combos.length === 0 ? (
        <p className="mt-10 border border-line p-8 text-center font-sans text-sm text-stone">
          No sets yet. A set is several fragrances boxed together at one price —
          it carries its own stock, so selling a box does not touch bottle
          inventory.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-line border border-line">
          {combos.map((c) => {
            const v = c.variants[0];
            const low = v ? v.stock > 0 && v.stock < LOW_STOCK_AT : false;
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-4 px-4 py-4">
                <Link
                  href={`/admin/combos/${c.id}`}
                  className="min-w-0 flex-1 font-sans text-sm text-bone transition-colors hover:text-gold-light"
                >
                  {c.name}
                  <span className="ml-3 font-sans text-xs text-stone">
                    {/* Live count — never a hardcoded number. */}
                    {c._count.comboItems} fragrance
                    {c._count.comboItems === 1 ? "" : "s"}
                  </span>
                </Link>

                {c.isFeatured && <AdminChip tone="gold">Homepage</AdminChip>}
                {!c.couponEligible && <AdminChip>No coupons</AdminChip>}
                <AdminChip tone={c.isActive ? "gold" : undefined}>
                  {c.isActive ? "Live" : "Retired"}
                </AdminChip>

                {v && (
                  <span className="font-sans text-xs tabular-nums text-stone">
                    {formatPaise(v.pricePaise)}
                  </span>
                )}
                <span
                  className={
                    v && v.stock <= 0
                      ? "font-sans text-xs text-danger"
                      : low
                        ? "font-sans text-xs text-warning"
                        : "font-sans text-xs text-stone"
                  }
                >
                  {v ? (v.stock <= 0 ? "Out" : `${v.stock} left`) : "No SKU"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
