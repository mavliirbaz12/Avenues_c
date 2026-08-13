"use server";

import { revalidatePath } from "next/cache";
import { ReviewStatus, EnquiryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminActor } from "@/lib/admin-guard";
import { recalcProductRating } from "@/lib/commerce/reviews";

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

  revalidatePath("/admin/reviews");
  revalidatePath(`/fragrance/${review.product.slug}`);
  revalidatePath("/shop");
}

export async function deleteReview(reviewId: string) {
  await requireAdminActor();

  const review = await prisma.review.delete({
    where: { id: reviewId },
    select: { productId: true, product: { select: { slug: true } } },
  });

  await recalcProductRating(review.productId);

  revalidatePath("/admin/reviews");
  revalidatePath(`/fragrance/${review.product.slug}`);
  revalidatePath("/shop");
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
