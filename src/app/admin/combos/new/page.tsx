import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/ui";
import { ComboForm } from "@/components/admin/combo-form";

export const dynamic = "force-dynamic";

export default async function NewComboPage() {
  // Only fragrances can go in a box — a set inside a set would recurse on the
  // storefront, and the server action refuses it too.
  const products = await prisma.product.findMany({
    where: { type: "SINGLE" },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader title="New gift set">
        <p className="mt-2 font-sans text-xs text-stone">
          Add as many or as few fragrances as the box holds — two, four, ten.
          The composition can change later at any time.
        </p>
      </AdminPageHeader>
      <div className="mt-8">
        <ComboForm products={products} />
      </div>
    </div>
  );
}
