import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import { requireAdmin } from "@/lib/auth-guards";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requireAdmin();

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
        <AdminPageHeader title="New product">
          <p className="mt-2 font-sans text-xs text-stone">
            Create it hidden, add sizes and images, then flip it live.
          </p>
        </AdminPageHeader>
      </div>

      <div className="mt-8">
        <ProductForm />
      </div>
    </div>
  );
}
