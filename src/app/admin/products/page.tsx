import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatPaise } from "@/lib/format";
import { AdminPageHeader, AdminChip } from "@/components/admin/ui";
import { BottleFigure } from "@/components/brand/bottle-figure";
import { requireAdmin } from "@/lib/auth-guards";

export const dynamic = "force-dynamic";

const LOW_STOCK_AT = 10;

export default async function AdminProductsPage() {
  await requireAdmin();

  // `select`, not `include`. The previous `include` pulled every Product
  // column — four @db.Text fields (description, sensoryNarrative, howToUse,
  // caution) plus the notes, occasions and whyChoose arrays — and full Variant
  // rows, none of which this list renders. On a catalogue with real long-form
  // copy that is a large transfer for a page showing names and stock counts.
  const products = await prisma.product.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      slug: true,
      name: true,
      gender: true,
      isActive: true,
      isFeatured: true,
      variants: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, size: true, stock: true, pricePaise: true, isActive: true },
      },
      images: { where: { isPrimary: true }, take: 1, select: { url: true } },
      _count: { select: { reviews: true } },
    },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Products"
        actions={
          <Link href="/admin/products/new" className="btn btn-primary btn-sm">
            <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
            New product
          </Link>
        }
      >
        <p className="mt-2 font-sans text-xs text-stone">
          {products.length} product{products.length === 1 ? "" : "s"} ·{" "}
          {products.filter((p) => p.isActive).length} live on the storefront
        </p>
      </AdminPageHeader>

      <ul className="mt-8 divide-y divide-line border border-line">
        {products.map((p) => {
          const totalStock = p.variants.reduce((n, v) => n + v.stock, 0);
          const low = p.variants.some((v) => v.isActive && v.stock < LOW_STOCK_AT);
          const from = p.variants.filter((v) => v.isActive)[0];

          return (
            <li key={p.id}>
              <Link
                href={`/admin/products/${p.id}`}
                className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface"
              >
                <span className="relative h-14 w-12 shrink-0 overflow-hidden border border-line bg-ink-deep">
                  {p.images[0] ? (
                    <Image src={p.images[0].url} alt="" fill sizes="48px" className="object-cover" />
                  ) : (
                    <BottleFigure slug={p.slug} />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-sans text-sm text-bone">{p.name}</span>
                    {!p.isActive && <AdminChip tone="quiet">Hidden</AdminChip>}
                    {p.isFeatured && <AdminChip tone="gold">Featured</AdminChip>}
                    {low && <AdminChip tone="warn">Low stock</AdminChip>}
                  </span>
                  <span className="mt-0.5 block font-sans text-xs text-stone-dark">
                    /{p.slug} · {p.gender.toLowerCase()} ·{" "}
                    {p.variants.map((v) => `${v.size}${v.isActive ? "" : " (off)"}`).join(", ") || "no variants"}
                  </span>
                </span>

                <span className="hidden shrink-0 text-right sm:block">
                  <span className="block font-sans text-xs tabular-nums text-bone">
                    {from ? formatPaise(from.pricePaise) : "—"}
                  </span>
                  <span className="block font-sans text-[0.6875rem] tabular-nums text-stone-dark">
                    {totalStock} in stock
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
