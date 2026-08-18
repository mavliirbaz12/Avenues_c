"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminActor } from "@/lib/admin-guard";
import { slugify } from "@/lib/utils";
import { rupeeInputToPaise } from "@/lib/format";
import type { FormState, SimpleActionState } from "@/lib/form-state";

/**
 * Gift-set mutations.
 *
 * A combo is a Product with `type: COMBO` and exactly one Variant carrying the
 * packaged SKU's own stock — see the note on ProductType in schema.prisma for
 * why it is not a separate model.
 *
 * NOTHING HERE CAPS THE NUMBER OF ITEMS. The contents arrive as parallel
 * `item.productId[]` / `item.sizeLabel[]` arrays of whatever length the
 * repeater submitted; the only floor is one, because a set of nothing is not a
 * set. Adding a fifth or a tenth fragrance needs no change to this file.
 */

const MAX_ITEMS = 40; // a sanity bound against a malformed post, not a product rule

const comboSchema = z.object({
  id: z.string().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Name the set.").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]*$/, "Lowercase letters, numbers and hyphens only.")
    .max(80)
    .optional()
    .or(z.literal("")),
  tagline: z.string().trim().min(2, "A short tagline.").max(160),
  highlight: z.string().trim().min(2, "The one-line promise.").max(200),
  description: z.string().trim().min(40, "A paragraph at least.").max(4000),
  savingsNote: z.string().trim().max(160).optional().or(z.literal("")),
  howToUse: z.string().trim().max(2000).default(""),
  caution: z.string().trim().max(2000).default(""),

  sku: z.string().trim().min(2, "SKU is required.").max(60).toUpperCase(),
  mrp: z.string().trim().min(1, "MRP is required."),
  price: z.string().trim().min(1, "Offer price is required."),
  stock: z.coerce.number().int().min(0, "Stock can't be negative.").max(100000),
  weightGrams: z.coerce.number().int().min(50).max(20000).default(400),

  isActive: z.coerce.boolean().default(false),
  isFeatured: z.coerce.boolean().default(false),
  // Sets are already priced below the sum of their parts, so this is off
  // unless the founder deliberately turns it on.
  couponEligible: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  metaTitle: z.string().trim().max(160).optional().or(z.literal("")),
  metaDescription: z.string().trim().max(300).optional().or(z.literal("")),
});

/** Reads the repeater's parallel arrays into ordered rows, dropping blanks. */
function readItems(formData: FormData) {
  const productIds = formData.getAll("item.productId").map(String);
  const sizes = formData.getAll("item.sizeLabel").map(String);

  const rows: { productId: string; sizeLabel: string; position: number }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < productIds.length && rows.length < MAX_ITEMS; i++) {
    const productId = productIds[i]?.trim();
    const sizeLabel = (sizes[i] ?? "").trim();
    // A row the admin added but never filled in is not an error — just skip it.
    if (!productId || !sizeLabel) continue;

    // The same fragrance may appear at two sizes, but not twice at one.
    const key = `${productId}::${sizeLabel.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({ productId, sizeLabel: sizeLabel.slice(0, 40), position: rows.length });
  }

  return rows;
}

export async function saveCombo(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminActor();

  const raw = Object.fromEntries(
    [...formData.entries()].filter(([k]) => !k.startsWith("$") && !k.startsWith("item.")),
  ) as Record<string, string>;

  const parsed = comboSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  }

  const d = parsed.data;
  const items = readItems(formData);

  if (items.length < 1) {
    return {
      ok: false,
      message: "A set needs at least one fragrance. Use “Add item” to put something in the box.",
    };
  }

  // Every referenced product must exist and be a fragrance — a set inside a
  // set has no meaning and would recurse on the storefront.
  const referenced = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    select: { id: true, type: true, name: true },
  });
  const byId = new Map(referenced.map((p) => [p.id, p]));

  for (const item of items) {
    const p = byId.get(item.productId);
    if (!p) return { ok: false, message: "One of the chosen fragrances no longer exists." };
    if (p.type === "COMBO") {
      return { ok: false, message: `“${p.name}” is itself a set and can't go inside another.` };
    }
  }

  const slug = d.slug || slugify(d.name.replace(/^Avenues\s+/i, ""));
  if (!slug) return { ok: false, message: "", fieldErrors: { slug: "Give it a slug." } };

  const mrpPaise = rupeeInputToPaise(d.mrp);
  const pricePaise = rupeeInputToPaise(d.price);
  if (mrpPaise === null || pricePaise === null) {
    return { ok: false, message: "", fieldErrors: { price: "Enter prices in rupees, e.g. 1199." } };
  }
  if (pricePaise > mrpPaise) {
    return {
      ok: false,
      message: "",
      fieldErrors: { price: "The offer price can't be above the MRP." },
    };
  }

  const productData = {
    name: d.name,
    slug,
    tagline: d.tagline,
    highlight: d.highlight,
    description: d.description,
    savingsNote: d.savingsNote || null,
    howToUse: d.howToUse,
    caution: d.caution,
    type: "COMBO" as const,
    // A set has no pyramid of its own; its members each have one, read live.
    notesTop: [],
    notesHeart: [],
    notesBase: [],
    gender: "UNISEX" as const,
    concentration: "Gift set",
    longevity: "",
    isActive: d.isActive,
    isFeatured: d.isFeatured,
    couponEligible: d.couponEligible,
    sortOrder: d.sortOrder,
    metaTitle: d.metaTitle || null,
    metaDescription: d.metaDescription || null,
  };

  try {
    const comboId = await prisma.$transaction(async (tx) => {
      let id = d.id || "";

      if (id) {
        const before = await tx.product.findUnique({ where: { id }, select: { slug: true } });
        await tx.product.update({ where: { id }, data: productData });
        if (before && before.slug !== slug) revalidatePath(`/set/${before.slug}`);
        revalidateTag(CATALOG_TAG);
      } else {
        const created = await tx.product.create({
          data: { ...productData, occasions: [], whyChoose: [] },
          select: { id: true },
        });
        id = created.id;
      }

      // One Variant per combo: the packaged SKU. Its stock is the set's own and
      // is never derived from the stock of the bottles inside.
      const existing = await tx.variant.findFirst({
        where: { productId: id },
        select: { id: true },
      });
      const variantData = {
        size: `${items.length} x ${items[0]!.sizeLabel}`,
        sku: d.sku,
        mrpPaise,
        pricePaise,
        stock: d.stock,
        weightGrams: d.weightGrams,
        isActive: true,
      };
      if (existing) {
        await tx.variant.update({ where: { id: existing.id }, data: variantData });
      } else {
        await tx.variant.create({ data: { ...variantData, productId: id, sortOrder: 0 } });
      }

      // Contents are replaced wholesale rather than diffed. The repeater
      // submits the complete intended list every time, so a delete is just an
      // absence — diffing would only add a way to get it wrong.
      await tx.comboItem.deleteMany({ where: { comboId: id } });
      await tx.comboItem.createMany({
        data: items.map((i) => ({ ...i, comboId: id })),
      });

      return id;
    });

    revalidateCombo(slug);
    return d.id
      ? { ok: true, message: `Saved — ${items.length} in the box.` }
      : {
          ok: true,
          message: "Set created.",
          redirectTo: `/admin/combos/${comboId}`,
        };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = String(err.meta?.target ?? "");
      return {
        ok: false,
        message: "",
        fieldErrors: target.includes("sku")
          ? { sku: "That SKU is already used." }
          : { slug: "That slug is already taken." },
      };
    }
    console.error("[admin:combos] save failed:", err);
    return { ok: false, message: "Something went wrong saving the set." };
  }
}

export async function toggleComboActive(
  comboId: string,
  isActive: boolean,
): Promise<SimpleActionState> {
  await requireAdminActor();
  const combo = await prisma.product.update({
    where: { id: comboId },
    data: { isActive },
    select: { slug: true },
  });
  revalidateCombo(combo.slug);
  return { ok: true, message: isActive ? "Live on the storefront." : "Retired." };
}

/**
 * Only one set can headline the landing page, so featuring one un-features the
 * others. Without this an admin ends up with three "featured" sets and no way
 * to tell which the homepage will pick.
 */
export async function setFeaturedCombo(comboId: string): Promise<SimpleActionState> {
  await requireAdminActor();

  await prisma.$transaction([
    prisma.product.updateMany({
      where: { type: "COMBO", isFeatured: true },
      data: { isFeatured: false },
    }),
    prisma.product.update({ where: { id: comboId }, data: { isFeatured: true } }),
  ]);

  revalidatePath("/");
  revalidateTag(CATALOG_TAG);
  revalidatePath("/sets");
  revalidatePath("/admin/combos");
  return { ok: true, message: "Featured on the homepage." };
}

export async function deleteCombo(comboId: string): Promise<SimpleActionState> {
  await requireAdminActor();

  const combo = await prisma.product.findUnique({
    where: { id: comboId },
    select: { type: true, slug: true },
  });
  if (!combo || combo.type !== "COMBO") {
    return { ok: false, message: "That isn't a gift set." };
  }

  // Refuse if it has ever been ordered: OrderItem keeps a snapshot, but the
  // variant row is what a refund and the packing list resolve against.
  const sold = await prisma.orderItem.count({ where: { variant: { productId: comboId } } });
  if (sold > 0) {
    return {
      ok: false,
      message: `This set appears on ${sold} order${sold === 1 ? "" : "s"}. Retire it instead of deleting, so those orders stay intact.`,
    };
  }

  await prisma.product.delete({ where: { id: comboId } });
  revalidateCombo(combo.slug);
  return { ok: true, message: "Set deleted." };
}

function revalidateCombo(slug: string) {
  revalidatePath("/");
  revalidateTag(CATALOG_TAG);
  revalidatePath("/shop");
  revalidatePath("/sets");
  revalidatePath(`/set/${slug}`);
  revalidatePath("/admin/combos");
}
