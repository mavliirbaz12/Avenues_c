import type { Metadata } from "next";
import { EnquiryStatus, ReviewStatus, OrderStatus } from "@prisma/client";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: { default: "Back of house", template: "%s · Admin · Avenues" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Admin chrome — "back of house". Same palette as the storefront but
 * flattened: no glass, no scroll motion, denser type. The role guard here
 * covers pages; every server action separately calls requireAdminActor().
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  // Work-queue badges: things waiting on a human.
  const [newOrders, pendingReviews, newEnquiries] = await Promise.all([
    prisma.order.count({ where: { status: OrderStatus.CONFIRMED } }),
    prisma.review.count({ where: { status: ReviewStatus.PENDING } }),
    prisma.enquiry.count({ where: { status: EnquiryStatus.NEW } }),
  ]);

  return (
    <div className="min-h-dvh bg-ink pb-20 lg:pb-0 lg:pl-52">
      <AdminNav
        pendingBadges={{
          "/admin/orders": newOrders,
          "/admin/reviews": pendingReviews,
          "/admin/enquiries": newEnquiries,
        }}
      />
      <div className="px-4 py-8 sm:px-8 lg:px-10">{children}</div>
    </div>
  );
}
