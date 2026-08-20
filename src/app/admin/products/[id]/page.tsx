import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader, AdminChip } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import { VariantEditor } from "@/components/admin/variant-editor";
import { ImageManager } from "@/components/admin/image-manager";
import { DeleteProductPanel } from "@/components/admin/delete-entity";
import { integrations } from "@/lib/env";
import { requireAdmin } from "@/lib/auth-guards";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      images: { orderBy: { position: "asc" } },
    },
  });
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-2 font-sans text-[0.6875rem] uppercase tracking-label text-stone transition-colors hover:text-gold-light"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.6} />
        Products
      </Link>

      <div className="mt-4">
        <AdminPageHeader
          title={product.name}
          actions={
            <Link
              href={`/fragrance/${product.slug}`}
              target="_blank"
              className="btn btn-ghost btn-sm"
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.6} />
              View live
            </Link>
          }
        >
          <p className="mt-2 flex flex-wrap items-center gap-2 font-sans text-xs text-stone">
            /{product.slug}
            {product.isActive ? (
              <AdminChip tone="ok">Live</AdminChip>
            ) : (
              <AdminChip tone="quiet">Hidden</AdminChip>
            )}
          </p>
        </AdminPageHeader>
      </div>

      <div className="mt-8 space-y-8">
        <ImageManager
          productId={product.id}
          images={product.images.map((i) => ({
            id: i.id,
            url: i.url,
            alt: i.alt,
            isPrimary: i.isPrimary,
            position: i.position,
          }))}
          uploadEnabled={integrations.cloudinary}
        />

        <VariantEditor
          productId={product.id}
          variants={product.variants.map((v) => ({
            id: v.id,
            size: v.size,
            sku: v.sku,
            mrpPaise: v.mrpPaise,
            pricePaise: v.pricePaise,
            stock: v.stock,
            weightGrams: v.weightGrams,
            isActive: v.isActive,
          }))}
        />

        <ProductForm
          values={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            tagline: product.tagline,
            highlight: product.highlight,
            description: product.description,
            concentration: product.concentration,
            gender: product.gender,
            notesTop: product.notesTop,
            notesHeart: product.notesHeart,
            notesBase: product.notesBase,
            occasions: product.occasions,
            whyChoose: product.whyChoose,
            howToUse: product.howToUse,
            caution: product.caution,
            longevity: product.longevity,
            sensoryNarrative: product.sensoryNarrative,
            bestFor: product.bestFor,
            countryOfOrigin: product.countryOfOrigin,
            isActive: product.isActive,
            isFeatured: product.isFeatured,
            sortOrder: product.sortOrder,
            metaTitle: product.metaTitle,
            metaDescription: product.metaDescription,
          }}
        />

        <DeleteProductPanel
          productId={product.id}
          name={product.name}
          isCombo={product.type === "COMBO"}
        />
      </div>
    </div>
  );
}
