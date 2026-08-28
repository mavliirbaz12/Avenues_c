"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { ReviewStatus, EnquiryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminActor } from "@/lib/admin-guard";
import { recalcProductRating } from "@/lib/commerce/reviews";
import { CATALOG_TAG } from "@/lib/cache";

/* -------------------------------------------------------------------------- */
/* Review moderation                                                           */
/* -------------------------------------------------------------------------- */

export async function moderateReview(reviewId: string, decision: "APPROVED" | "HIDDEN") {
  await requireAdminActor();

  const review = await prisma.review.update({
    where: { id: reviewId },
    data: { status: decision as ReviewStatus, moderatedAt: new Date() },
    select: { productId: true, product: { select: { slug: true } } },
  });

  // Aggregates count APPROVED only, so every moderation decision recomputes.
  await recalcProductRating(review.productId);

  revalidateReview(review.product.slug);
}

/**
 * Everything a moderation decision changes.
 *
 * The landing page carries a review rail now, so approving a review has to
 * refresh "/" as well — and the rail's query is wrapped in `cachedCatalog`, so
 * the tag has to go with it. Without both, a review approved in admin would not
 * reach the home page until the hourly revalidate came round, and the admin
 * would reasonably conclude the feature was broken.
 *
 * Extracted because the two call sites had already been copied once and would
 * have drifted the moment one of them learned about a new surface.
 */
function revalidateReview(productSlug: string) {
  revalidatePath("/admin/reviews");
  revalidatePath(`/fragrance/${productSlug}`);
  revalidatePath("/shop");
  revalidatePath("/");
  revalidateTag(CATALOG_TAG);
}

export async function deleteReview(reviewId: string) {
  await requireAdminActor();

  const review = await prisma.review.delete({
    where: { id: reviewId },
    select: { productId: true, product: { select: { slug: true } } },
  });

  await recalcProductRating(review.productId);

  revalidateReview(review.product.slug);
}

/* -------------------------------------------------------------------------- */
/* Enquiries                                                                   */
/* -------------------------------------------------------------------------- */

export async function setEnquiryStatus(enquiryId: string, status: EnquiryStatus) {
  await requireAdminActor();

  await prisma.enquiry.update({
    where: { id: enquiryId },
    data: {
      status,
      handledAt: status === EnquiryStatus.NEW ? null : new Date(),
    },
  });

  revalidatePath("/admin/enquiries");
}
