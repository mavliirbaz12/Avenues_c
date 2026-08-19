import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/ui";
import { CollectionManager } from "@/components/admin/collection-manager";
import { requireAdmin } from "@/lib/auth-guards";

export const dynamic = "force-dynamic";

export default async function AdminCollectionsPage() {
  await requireAdmin();

  const [collections, products] = await Promise.all([
    prisma.collection.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { products: { orderBy: { position: "asc" }, select: { productId: true } } },
    }),
    prisma.product.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader title="Collections">
        <p className="mt-2 font-sans text-xs text-stone">
          Merchandising groups — a future &ldquo;Women&rdquo; or &ldquo;Unisex&rdquo;
          launch gets a collection here, no deploy needed.
        </p>
      </AdminPageHeader>

      <div className="mt-8">
        <CollectionManager
          collections={collections.map((c) => ({
            id: c.id,
            slug: c.slug,
            title: c.title,
            subtitle: c.subtitle,
            description: c.description,
            isActive: c.isActive,
            sortOrder: c.sortOrder,
            productIds: c.products.map((p) => p.productId),
          }))}
          products={products}
        />
      </div>
    </div>
  );
}
