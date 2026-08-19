import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/ui";
import { CouponManager } from "@/components/admin/coupon-manager";
import { requireAdmin } from "@/lib/auth-guards";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  await requireAdmin();

  const coupons = await prisma.coupon.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader title="Coupons">
        <p className="mt-2 font-sans text-xs text-stone">
          Codes are validated server-side at checkout: window, usage caps,
          per-customer limits and minimum order all enforced there.
        </p>
      </AdminPageHeader>

      <div className="mt-8">
        <CouponManager coupons={coupons} />
      </div>
    </div>
  );
}
