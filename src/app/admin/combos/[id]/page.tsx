import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/ui";
import { ComboForm } from "@/components/admin/combo-form";
import { ImageManager } from "@/components/admin/image-manager";
import { integrations } from "@/lib/env";
import { requireAdmin } from "@/lib/auth-guards";

export const dynamic = "force-dynamic";

export default async function EditComboPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;

  const [combo, products] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: { sortOrder: "asc" }, take: 1 },
        images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }] },
        comboItems: { orderBy: { position: "asc" } },
      },
    }),
    prisma.product.findMany({
      where: { type: "SINGLE" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!combo || combo.type !== "COMBO") notFound();

  const v = combo.variants[0];
  const rupees = (paise: number | undefined) =>
    paise === undefined ? "" : String(Math.round(paise / 100));

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader title={combo.name}>
        <p className="mt-2 font-sans text-xs text-stone">
          {combo.comboItems.length} fragrance
          {combo.comboItems.length === 1 ? "" : "s"} in the box ·{" "}
          <Link href={`/set/${combo.slug}`} className="text-gold hover:text-gold-light">
            View on the storefront
          </Link>
        </p>
      </AdminPageHeader>

      <div className="mt-8 space-y-10">
        <ComboForm
          products={products}
          values={{
            id: combo.id,
            name: combo.name,
            slug: combo.slug,
            tagline: combo.tagline,
            highlight: combo.highlight,
            description: combo.description,
            savingsNote: combo.savingsNote ?? "",
            howToUse: combo.howToUse,
            caution: combo.caution,
            sku: v?.sku ?? "",
            mrp: rupees(v?.mrpPaise),
            price: rupees(v?.pricePaise),
            stock: v?.stock ?? 0,
            weightGrams: v?.weightGrams ?? 400,
            isActive: combo.isActive,
            isFeatured: combo.isFeatured,
            couponEligible: combo.couponEligible,
            sortOrder: combo.sortOrder,
            metaTitle: combo.metaTitle ?? "",
            metaDescription: combo.metaDescription ?? "",
            items: combo.comboItems.map((i) => ({
              productId: i.productId,
              sizeLabel: i.sizeLabel,
            })),
          }}
        />

        <section className="border border-line p-5 sm:p-6">
          <h2 className="mb-5 font-display text-xl font-light text-bone">Images</h2>
          <ImageManager
            productId={combo.id}
            images={combo.images}
            uploadEnabled={integrations.cloudinary}
          />
        </section>
      </div>
    </div>
  );
}
