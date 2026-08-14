"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, ReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { limitByIp } from "@/lib/rate-limit";
import { isVerifiedBuyer } from "@/lib/commerce/reviews";
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

  try {
    await prisma.review.create({
      data: {
        productId: product.id,
        userId,
        rating: parsed.data.rating,
        title: parsed.data.title || null,
        body: parsed.data.body,
        isVerifiedBuyer: verified,
        status: ReviewStatus.PENDING,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, message: "You've already reviewed this fragrance — one per customer." };
    }
    console.error("[reviews] submit failed:", err);
    return { ok: false, message: "Something went wrong. Try again in a moment." };
  }

  revalidatePath(`/fragrance/${product.slug}`);
  return {
    ok: true,
    message: "Thank you. Your review will appear once it clears a quick moderation check.",
  };
}
