"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminActor } from "@/lib/admin-guard";
import { rupeeInputToPaise } from "@/lib/format";
import type { AdminFormState } from "./products";

const settingsSchema = z.object({
  shippingFlat: z.string().trim().min(1, "Flat shipping rate is required."),
  freeShippingThreshold: z.string().trim().min(1, "Free-shipping threshold is required."),
  codEnabled: z.coerce.boolean().default(false),
  codFee: z.string().trim().optional().or(z.literal("")),
  codMaxOrder: z.string().trim().optional().or(z.literal("")),
  delhiveryPickupName: z.string().trim().max(120).optional().or(z.literal("")),
  whatsappNumber: z
    .string()
    .trim()
    .regex(/^\d{10,14}$/, "Digits only, with country code — e.g. 919876543210.")
    .optional()
    .or(z.literal("")),
  supportEmail: z.string().trim().toLowerCase().email("Enter a valid email."),
  supportPhone: z.string().trim().max(20).optional().or(z.literal("")),
  manufacturerName: z.string().trim().min(2).max(160),
  manufacturerAddress: z.string().trim().max(600).optional().or(z.literal("")),
  customerCareEmail: z.string().trim().toLowerCase().email("Enter a valid email."),
  customerCarePhone: z.string().trim().max(20).optional().or(z.literal("")),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/, "That doesn't look like a GSTIN.")
    .optional()
    .or(z.literal("")),
  invoicePrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, "2–8 letters/numbers."),
  instagramUrl: z.string().trim().url("Full URL, with https://").optional().or(z.literal("")),
  facebookUrl: z.string().trim().url("Full URL, with https://").optional().or(z.literal("")),
});

export async function saveSettings(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdminActor();

  const parsed = settingsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  }

  const d = parsed.data;

  await prisma.storeSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  await prisma.storeSetting.update({
    where: { id: 1 },
    data: {
      shippingFlatPaise: rupeeInputToPaise(d.shippingFlat),
      freeShippingThresholdPaise: rupeeInputToPaise(d.freeShippingThreshold),
      codEnabled: d.codEnabled,
      codFeePaise: d.codFee ? rupeeInputToPaise(d.codFee) : 0,
      codMaxOrderPaise: d.codMaxOrder ? rupeeInputToPaise(d.codMaxOrder) : null,
      delhiveryPickupName: d.delhiveryPickupName || null,
      whatsappNumber: d.whatsappNumber || null,
      supportEmail: d.supportEmail,
      supportPhone: d.supportPhone || null,
      manufacturerName: d.manufacturerName,
      manufacturerAddress: d.manufacturerAddress || "",
      customerCareEmail: d.customerCareEmail,
      customerCarePhone: d.customerCarePhone || null,
      gstin: d.gstin || null,
      invoicePrefix: d.invoicePrefix,
      instagramUrl: d.instagramUrl || null,
      facebookUrl: d.facebookUrl || null,
    },
  });

  // Settings feed the storefront shell (footer, WhatsApp button, PDP legal
  // block), so flush broadly.
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  return { ok: true, message: "Settings saved." };
}
