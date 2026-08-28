"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { Prisma, ReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { limitByIp } from "@/lib/rate-limit";
import { isVerifiedBuyer, recalcProductRating } from "@/lib/commerce/reviews";
import { CATALOG_TAG } from "@/lib/cache";
import type { FormState } from "@/lib/form-state";

const schema = z.object({
  productId: z.string().min(1),
  rating: z.coerce.number().int().min(1, "Pick a rating.").max(5),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  body: z
    .string()
    .trim()
    .min(20, "A few sentences, please — what it smells like, how long it lasted.")
    .max(3000),
});

/**
 * Submits a review. Requires an account (anonymous reviews are worthless for
 * trust), allows one per customer per fragrance, and goes to PENDING for
 * moderation — it will not appear on the product page or move the aggregate
 * rating until approved.
 */
export async function submitReview(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, message: "Sign in to review — it keeps the ratings honest." };
  }

  const limit = await limitByIp("review", 5, 600_000);
  if (!limit.ok) {
    return { ok: false, message: `Too many attempts. Try again in ${limit.retryAfter}s.` };
  }

  const parsed = schema.safeParse({
    productId: formData.get("productId"),
    rating: formData.get("rating"),
    title: formData.get("title") ?? "",
    body: formData.get("body"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "", fieldErrors };
  }

  const product = await prisma.product.findFirst({
    where: { id: parsed.data.productId, isActive: true },
    select: { id: true, slug: true },
  });
  if (!product) return { ok: false, message: "That fragrance no longer exists." };

  const verified = await isVerifiedBuyer(userId, product.id);

  /*
    A VERIFIED BUYER PUBLISHES IMMEDIATELY. Everyone else queues.

    `isVerifiedBuyer` is not self-declared — it checks this account for a
    DELIVERED order containing this fragrance. Someone who paid for the bottle
    and received it has earned the right to say what they think without waiting
    on a human, and making them wait is how a store ends up with three reviews.

    The queue still exists for everyone else, which is what it is actually for:
    a competitor, a bot, or someone who has never bought anything has no
    delivered order and cannot post straight to a product page.

    The two paths differ only in status. Nothing else about the review changes,
    so a moderator can still hide a verified review later.
  */
  const status = verified ? ReviewStatus.APPROVED : ReviewStatus.PENDING;

  try {
    await prisma.review.create({
      data: {
        productId: product.id,
        userId,
        rating: parsed.data.rating,
        title: parsed.data.title || null,
        body: parsed.data.body,
        isVerifiedBuyer: verified,
        status,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, message: "You've already reviewed this fragrance — one per customer." };
    }
    console.error("[reviews] submit failed:", err);
    return { ok: false, message: "Something went wrong. Try again in a moment." };
  }

  /*
    A review that is live has to be recomputed and re-published, or the rating
    on the card and the rail on the home page keep the old numbers for an hour.
    Only the approved path needs it — a pending review changes nothing anyone
    can see yet.
  */
  if (status === ReviewStatus.APPROVED) {
    await recalcProductRating(product.id);
    revalidatePath("/shop");
    revalidatePath("/");
    revalidateTag(CATALOG_TAG);
  }
  revalidatePath(`/fragrance/${product.slug}`);

  return {
    ok: true,
    message: verified
      ? "Thank you — your review is live on the page."
      : "Thank you. Your review will appear once it clears a quick moderation check.",
  };
}
