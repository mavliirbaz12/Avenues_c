"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Gender, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminActor } from "@/lib/admin-guard";
import { slugify } from "@/lib/utils";
import { rupeeInputToPaise } from "@/lib/format";
import type { FormState, SimpleActionState } from "@/lib/form-state";
import { combosContaining } from "@/lib/catalog";

/** "Bergamot, Lavender" → ["Bergamot", "Lavender"] */
function csvList(input: string, max = 12) {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

/** One entry per line → string[] */
function lineList(input: string, max = 10) {
  return input
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

function collectErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Product create / update                                                     */
/* -------------------------------------------------------------------------- */

const productSchema = z.object({
  id: z.string().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Name the fragrance.").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]*$/, "Lowercase letters, numbers and hyphens only.")
    .max(80)
    .optional()
    .or(z.literal("")),
  tagline: z.string().trim().min(2, "A short tagline, e.g. Bold. Fresh. Powerful.").max(160),
  highlight: z.string().trim().min(2, "The one-line promise.").max(200),
  description: z.string().trim().min(40, "Give it a real description — a paragraph at least.").max(4000),
  concentration: z.string().trim().min(2).max(60).default("Eau De Parfum"),
  gender: z.nativeEnum(Gender),
  notesTop: z.string().trim().max(400).default(""),
  notesHeart: z.string().trim().max(400).default(""),
  notesBase: z.string().trim().max(400).default(""),
  occasions: z.string().trim().max(400).default(""),
  whyChoose: z.string().trim().max(2000).default(""),
  howToUse: z.string().trim().max(2000).default(""),
  caution: z.string().trim().max(2000).default(""),
  longevity: z.string().trim().max(60).default("8-10 hours"),
  sensoryNarrative: z.string().trim().max(2000).default(""),
  bestFor: z.string().trim().max(300).default(""),
  countryOfOrigin: z.string().trim().max(80).default("India"),
  isActive: z.coerce.boolean().default(false),
  isFeatured: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  metaTitle: z.string().trim().max(160).optional().or(z.literal("")),
  metaDescription: z.string().trim().max(300).optional().or(z.literal("")),
});

export async function saveProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminActor();

  const raw = Object.fromEntries(
    [...formData.entries()].filter(([k]) => !k.startsWith("$")),
  ) as Record<string, string>;
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors: collectErrors(parsed.error) };
  }

  const d = parsed.data;
  const slug = d.slug || slugify(d.name.replace(/^Avenues\s+/i, ""));
  if (!slug) {
    return { ok: false, message: "", fieldErrors: { slug: "Give it a slug." } };
  }

  const data = {
    name: d.name,
    slug,
    tagline: d.tagline,
    highlight: d.highlight,
    description: d.description,
    concentration: d.concentration,
    gender: d.gender,
    notesTop: csvList(d.notesTop),
    notesHeart: csvList(d.notesHeart),
    notesBase: csvList(d.notesBase),
    occasions: csvList(d.occasions),
    whyChoose: lineList(d.whyChoose),
    howToUse: d.howToUse,
    caution: d.caution,
    longevity: d.longevity,
    sensoryNarrative: d.sensoryNarrative,
    bestFor: d.bestFor,
    countryOfOrigin: d.countryOfOrigin,
    isActive: d.isActive,
    isFeatured: d.isFeatured,
    sortOrder: d.sortOrder,
    metaTitle: d.metaTitle || null,
    metaDescription: d.metaDescription || null,
  };

  try {
    if (d.id) {
      const before = await prisma.product.findUnique({
        where: { id: d.id },
        select: { slug: true, isActive: true },
      });

      // Going live -> retired is the destructive transition; guard it here
      // because this checkbox, not toggleProductActive, is what admins use.
      if (before?.isActive && !d.isActive) {
        const refusal = await blockedByCombos(d.id);
        if (refusal) return { ok: false, message: refusal };
      }

      await prisma.product.update({ where: { id: d.id }, data });
      revalidateProduct(before?.slug, slug);
      return { ok: true, message: "Saved." };
    }

    const created = await prisma.product.create({ data, select: { id: true } });
    revalidateProduct(undefined, slug);
    return { ok: true, message: "Product created.", redirectTo: `/admin/products/${created.id}` };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, message: "", fieldErrors: { slug: "That slug is already taken." } };
    }
    console.error("[admin:products] save failed:", err);
    return { ok: false, message: "Something went wrong saving the product." };
  }
}

function revalidateProduct(oldSlug: string | undefined, newSlug: string) {
  revalidatePath("/");
  revalidateTag(CATALOG_TAG);
  revalidatePath("/shop");
  revalidatePath(`/fragrance/${newSlug}`);
  if (oldSlug && oldSlug !== newSlug) revalidatePath(`/fragrance/${oldSlug}`);
}

/**
 * Refuses to retire a fragrance that an active gift set contains.
 *
 * There is no hard delete in this admin — retiring is the destructive
 * operation, and it is the one that can break a set, because a set page reads
 * its members live. Retiring a member would leave a box whose contents no
 * longer link anywhere.
 *
 * Called from BOTH paths that can retire something: the product form's "Live
 * on the storefront" checkbox, which is what an admin actually uses, and
 * toggleProductActive. Retiring the SET itself is always allowed — nothing
 * depends on it.
 */
async function blockedByCombos(productId: string): Promise<string | null> {
  const blocking = await combosContaining(productId);
  if (blocking.length === 0) return null;

  const names = blocking.map((c) => c.name).join(", ");
  return (
    `This fragrance is inside ${blocking.length} active gift set` +
    `${blocking.length === 1 ? "" : "s"} (${names}). ` +
    `Remove it from ${blocking.length === 1 ? "that set" : "those sets"}, ` +
    `or retire the set first.`
  );
}

/**
 * Activate or retire a product.
 */
export async function toggleProductActive(
  productId: string,
  isActive: boolean,
): Promise<SimpleActionState> {
  await requireAdminActor();

  if (!isActive) {
    const refusal = await blockedByCombos(productId);
    if (refusal) return { ok: false, message: refusal };
  }

  const product = await prisma.product.update({
    where: { id: productId },
    data: { isActive },
    select: { slug: true },
  });
  revalidateProduct(product.slug, product.slug);
  revalidatePath("/admin/products");
  revalidatePath("/sets");
  revalidateTag(CATALOG_TAG);
  return { ok: true, message: isActive ? "Back on the storefront." : "Retired." };
}

/* -------------------------------------------------------------------------- */
/* Variants                                                                    */
/* -------------------------------------------------------------------------- */

const variantSchema = z.object({
  id: z.string().optional().or(z.literal("")),
  productId: z.string().min(1),
  size: z.string().trim().min(1, "Size, e.g. 50ml.").max(40),
  sku: z.string().trim().min(2, "SKU is required.").max(60).toUpperCase(),
  mrp: z.string().trim().min(1, "MRP is required."),
  price: z.string().trim().min(1, "Offer price is required."),
  stock: z.coerce.number().int().min(0, "Stock can't be negative.").max(100000),
  weightGrams: z.coerce.number().int().min(50).max(5000).default(250),
  isActive: z.coerce.boolean().default(true),
});

export async function saveVariant(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminActor();

  const parsed = variantSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, message: "Check the variant fields.", fieldErrors: collectErrors(parsed.error) };
  }

  const d = parsed.data;
  const mrpPaise = rupeeInputToPaise(d.mrp);
  const pricePaise = rupeeInputToPaise(d.price);

  if (mrpPaise <= 0) return { ok: false, message: "", fieldErrors: { mrp: "Enter a valid MRP." } };
  if (pricePaise <= 0 || pricePaise > mrpPaise) {
    return {
      ok: false,
      message: "",
      fieldErrors: { price: "Offer price must be positive and not exceed MRP." },
    };
  }

  const data = {
    size: d.size,
    sku: d.sku,
    mrpPaise,
    pricePaise,
    stock: d.stock,
    weightGrams: d.weightGrams,
    isActive: d.isActive,
  };

  try {
    if (d.id) {
      await prisma.variant.update({ where: { id: d.id }, data });
    } else {
      await prisma.variant.create({ data: { ...data, productId: d.productId } });
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = String((err.meta as { target?: string[] } | undefined)?.target ?? "");
      return target.includes("sku")
        ? { ok: false, message: "", fieldErrors: { sku: "That SKU already exists." } }
        : { ok: false, message: "", fieldErrors: { size: "This product already has that size." } };
    }
    console.error("[admin:variants] save failed:", err);
    return { ok: false, message: "Something went wrong saving the variant." };
  }

  const product = await prisma.product.findUnique({ where: { id: d.productId }, select: { slug: true } });
  if (product) revalidateProduct(product.slug, product.slug);
  revalidatePath(`/admin/products/${d.productId}`);
  return { ok: true, message: d.id ? "Variant saved." : "Variant added." };
}

export async function deleteVariant(variantId: string): Promise<FormState> {
  await requireAdminActor();

  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    select: { productId: true, product: { select: { slug: true } }, _count: { select: { orderItems: true } } },
  });
  if (!variant) return { ok: false, message: "Variant not found." };

  // A variant that has been sold is part of order history — deactivate, don't
  // delete. (OrderItems carry snapshots, but the FK would go dangling-null and
  // reporting by variant would quietly break.)
  if (variant._count.orderItems > 0) {
    await prisma.variant.update({ where: { id: variantId }, data: { isActive: false, stock: 0 } });
    revalidateProduct(variant.product.slug, variant.product.slug);
    revalidatePath(`/admin/products/${variant.productId}`);
    return { ok: true, message: "This size has past orders, so it was deactivated instead of deleted." };
  }

  await prisma.variant.delete({ where: { id: variantId } });
  revalidateProduct(variant.product.slug, variant.product.slug);
  revalidatePath(`/admin/products/${variant.productId}`);
  return { ok: true, message: "Variant deleted." };
}

/* -------------------------------------------------------------------------- */
/* Images                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Delete a product outright.
 *
 * Refused, not silently softened, when the fragrance has ever been ordered.
 * OrderItem keeps a text snapshot of what was bought, but `variantId` is what
 * a refund, the packing list and every per-product report resolve against, and
 * that FK is `SetNull` — so a delete would leave historic orders pointing at
 * nothing and quietly wrong rather than loudly broken. `isActive: false` takes
 * a fragrance off the storefront and keeps all of that intact, which is what
 * "remove this product" almost always means.
 *
 * Gift sets block it for the same reason retiring does: a set that contains a
 * deleted fragrance is a set that cannot be fulfilled.
 *
 * What is left after those two guards is the case this exists for — something
 * added by mistake, or a draft that never went live. Those delete cleanly, and
 * their variants, images, collection entries and reviews go with them by
 * cascade.
 */
export async function deleteProduct(productId: string): Promise<SimpleActionState> {
  await requireAdminActor();

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true, name: true, type: true },
  });
  if (!product) return { ok: false, message: "Product not found." };
  if (product.type === "COMBO") {
    return { ok: false, message: "That is a gift set — delete it from the gift sets page." };
  }

  const sold = await prisma.orderItem.count({ where: { variant: { productId } } });
  if (sold > 0) {
    return {
      ok: false,
      message:
        `${product.name} appears on ${sold} order${sold === 1 ? "" : "s"}. ` +
        `Retire it instead of deleting, so those orders keep their history.`,
    };
  }

  const refusal = await blockedByCombos(productId);
  if (refusal) return { ok: false, message: refusal };

  await prisma.product.delete({ where: { id: productId } });

  revalidateProduct(product.slug, product.slug);
  revalidatePath("/admin/products");
  revalidatePath("/sets");
  revalidateTag(CATALOG_TAG);
  return { ok: true, message: `${product.name} deleted.` };
}

export async function reorderImages(productId: string, orderedIds: string[]): Promise<void> {
  await requireAdminActor();

  await prisma.$transaction(
    orderedIds.map((id, position) =>
      prisma.productImage.updateMany({ where: { id, productId }, data: { position } }),
    ),
  );

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } });
  if (product) revalidateProduct(product.slug, product.slug);
  revalidatePath(`/admin/products/${productId}`);
}

export async function setPrimaryImage(productId: string, imageId: string): Promise<void> {
  await requireAdminActor();

  await prisma.$transaction([
    prisma.productImage.updateMany({ where: { productId }, data: { isPrimary: false } }),
    prisma.productImage.updateMany({ where: { id: imageId, productId }, data: { isPrimary: true } }),
  ]);

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } });
  if (product) revalidateProduct(product.slug, product.slug);
  revalidatePath(`/admin/products/${productId}`);
}

export async function deleteImage(imageId: string): Promise<void> {
  await requireAdminActor();

  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    select: { id: true, publicId: true, productId: true, product: { select: { slug: true } } },
  });
  if (!image) return;

  await prisma.productImage.delete({ where: { id: image.id } });

  // Purge from Cloudinary too, best effort — an orphan asset is a cost leak,
  // not a correctness problem.
  if (image.publicId) {
    const { destroyImage } = await import("@/lib/images/cloudinary");
    await destroyImage(image.publicId).catch((err) =>
      console.error("[admin:images] cloudinary destroy failed:", err),
    );
  }

  revalidateProduct(image.product.slug, image.product.slug);
  revalidatePath(`/admin/products/${image.productId}`);
}
