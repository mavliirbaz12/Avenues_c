import { OrderStatus, ReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Review helpers shared by the storefront submission path and admin
 * moderation — both must recompute the same aggregates.
 */

/** Recomputes the denormalised rating fields from APPROVED reviews only. */
export async function recalcProductRating(productId: string) {
  const agg = await prisma.review.aggregate({
    where: { productId, status: ReviewStatus.APPROVED },
    _avg: { rating: true },
    _count: true,
  });

  await prisma.product.update({
    where: { id: productId },
    data: {
      avgRating: agg._avg.rating ?? 0,
      reviewCount: agg._count,
    },
  });
}

/** Has this user had this product DELIVERED? Decides the verified-buyer badge. */
export async function isVerifiedBuyer(userId: string, productId: string) {
  const count = await prisma.orderItem.count({
    where: {
      order: { userId, status: OrderStatus.DELIVERED },
      variant: { productId },
    },
  });
  return count > 0;
}
