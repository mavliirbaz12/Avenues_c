"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/cache";
import { z } from "zod";
import { CouponType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminActor } from "@/lib/admin-guard";
import { rupeeInputToPaise } from "@/lib/format";
import { slugify } from "@/lib/utils";
import type { FormState } from "@/lib/form-state";

function collectErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Coupons                                                                     */
/* -------------------------------------------------------------------------- */

const couponSchema = z.object({
  id: z.string().optional().or(z.literal("")),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,24}$/, "3–24 letters and numbers, no spaces."),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  type: z.nativeEnum(CouponType),
  value: z.string().trim().min(1, "Value is required."),
  minOrder: z.string().trim().optional().or(z.literal("")),
  maxDiscount: z.string().trim().optional().or(z.literal("")),
  usageLimit: z.string().trim().optional().or(z.literal("")),
  perUserLimit: z.string().trim().optional().or(z.literal("")),
  startsAt: z.string().trim().optional().or(z.literal("")),
  endsAt: z.string().trim().optional().or(z.literal("")),
  isActive: z.coerce.boolean().default(false),
});

export async function saveCoupon(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminActor();

  const parsed = couponSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors: collectErrors(parsed.error) };
  }

  const d = parsed.data;
  const intOrNull = (s: string | undefined) => {
    if (!s) return null;
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  let valuePaise: number | null = null;
  let valuePercent: number | null = null;

  if (d.type === CouponType.FLAT) {
    valuePaise = rupeeInputToPaise(d.value);
    if (valuePaise <= 0) return { ok: false, message: "", fieldErrors: { value: "Enter the rupee amount off." } };
  } else {
    valuePercent = Number.parseInt(d.value, 10);
    if (!Number.isFinite(valuePercent) || valuePercent < 1 || valuePercent > 100) {
      return { ok: false, message: "", fieldErrors: { value: "Percentage between 1 and 100." } };
    }
  }

  const startsAt = d.startsAt ? new Date(d.startsAt) : null;
  const endsAt = d.endsAt ? new Date(d.endsAt) : null;
  if (startsAt && endsAt && endsAt <= startsAt) {
    return { ok: false, message: "", fieldErrors: { endsAt: "Must end after it starts." } };
  }

  const data = {
    code: d.code,
    description: d.description || null,
    type: d.type,
    valuePaise,
    valuePercent,
    minOrderPaise: d.minOrder ? rupeeInputToPaise(d.minOrder) : 0,
    maxDiscountPaise: d.maxDiscount ? rupeeInputToPaise(d.maxDiscount) : null,
    usageLimit: intOrNull(d.usageLimit),
    perUserLimit: intOrNull(d.perUserLimit),
    startsAt,
    endsAt,
    isActive: d.isActive,
  };

  try {
    if (d.id) {
      await prisma.coupon.update({ where: { id: d.id }, data });
    } else {
      await prisma.coupon.create({ data });
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, message: "", fieldErrors: { code: "That code already exists." } };
    }
    console.error("[admin:coupons] save failed:", err);
    return { ok: false, message: "Something went wrong saving the coupon." };
  }

  revalidatePath("/admin/coupons");
  return { ok: true, message: d.id ? "Coupon saved." : "Coupon created." };
}

export async function toggleCoupon(couponId: string, isActive: boolean) {
  await requireAdminActor();
  await prisma.coupon.update({ where: { id: couponId }, data: { isActive } });
  revalidatePath("/admin/coupons");
}

/* -------------------------------------------------------------------------- */
/* Collections                                                                 */
/* -------------------------------------------------------------------------- */

const collectionSchema = z.object({
  id: z.string().optional().or(z.literal("")),
  title: z.string().trim().min(2, "Name the collection.").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]*$/, "Lowercase letters, numbers and hyphens only.")
    .max(80)
    .optional()
    .or(z.literal("")),
  subtitle: z.string().trim().max(160).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.coerce.boolean().default(true),
  // Membership as a comma list of product ids, from the checkbox group.
  productIds: z.string().optional().or(z.literal("")),
});

export async function saveCollection(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminActor();

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  // Checkbox group arrives as repeated keys; collapse them.
  raw.productIds = formData.getAll("productIds").map(String).join(",");

  const parsed = collectionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors: collectErrors(parsed.error) };
  }

  const d = parsed.data;
  const slug = d.slug || slugify(d.title);
  const memberIds = (d.productIds ?? "").split(",").filter(Boolean);

  const data = {
    title: d.title,
    slug,
    subtitle: d.subtitle || null,
    description: d.description || null,
    sortOrder: d.sortOrder,
    isActive: d.isActive,
  };

  try {
    const collection = d.id
      ? await prisma.collection.update({ where: { id: d.id }, data, select: { id: true } })
      : await prisma.collection.create({ data, select: { id: true } });

    // Rewrite membership to exactly the checked set, preserving check order.
    await prisma.$transaction([
      prisma.productCollection.deleteMany({ where: { collectionId: collection.id } }),
      ...(memberIds.length
        ? [
            prisma.productCollection.createMany({
              data: memberIds.map((productId, position) => ({
                productId,
                collectionId: collection.id,
                position,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, message: "", fieldErrors: { slug: "That slug is already taken." } };
    }
    console.error("[admin:collections] save failed:", err);
    return { ok: false, message: "Something went wrong saving the collection." };
  }

  revalidatePath("/admin/collections");
  revalidatePath("/");
  revalidateTag(CATALOG_TAG);
  return { ok: true, message: d.id ? "Collection saved." : "Collection created." };
}

export async function deleteCollection(collectionId: string) {
  await requireAdminActor();
  await prisma.collection.delete({ where: { id: collectionId } });
  revalidatePath("/admin/collections");
  revalidatePath("/");
  revalidateTag(CATALOG_TAG);
}
