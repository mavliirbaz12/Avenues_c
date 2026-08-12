"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { AddressType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { limitByIp } from "@/lib/rate-limit";
import { INDIAN_STATES, PHONE_REGEX, PINCODE_REGEX } from "@/lib/constants/india";

export type FormState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

export const FORM_IDLE: FormState = { ok: false, message: "" };

async function requireUserId() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Not signed in.");
  return id;
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
/* Profile                                                                     */
/* -------------------------------------------------------------------------- */

const profileSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name.").max(120),
  phone: z
    .string()
    .trim()
    .regex(PHONE_REGEX, "Enter a valid 10-digit Indian mobile number.")
    .optional()
    .or(z.literal("")),
});

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) return { ok: false, message: "", fieldErrors: collectErrors(parsed.error) };

  await prisma.user.update({
    where: { id: userId },
    data: { name: parsed.data.name, phone: parsed.data.phone || null },
  });

  revalidatePath("/account");
  return { ok: true, message: "Profile updated." };
}

/* -------------------------------------------------------------------------- */
/* Password                                                                    */
/* -------------------------------------------------------------------------- */

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z
      .string()
      .min(8, "At least 8 characters.")
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/[0-9]/, "Include at least one number."),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, {
    message: "Both passwords must match.",
    path: ["confirm"],
  });

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();

  const limit = await limitByIp("change-password", 8, 900_000);
  if (!limit.ok) {
    return { ok: false, message: `Too many attempts. Try again in ${limit.retryAfter}s.` };
  }

  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { ok: false, message: "", fieldErrors: collectErrors(parsed.error) };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  // Google-only accounts have no password; sending them to the reset flow
  // sets one without needing an old value.
  if (!user?.passwordHash) {
    return {
      ok: false,
      message:
        "This account signs in with Google. Use 'Forgot password' to set a password for it.",
    };
  }

  const ok = await bcrypt.compare(parsed.data.current, user.passwordHash);
  if (!ok) {
    return { ok: false, message: "", fieldErrors: { current: "That password is incorrect." } };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(parsed.data.next, 12) },
  });

  return { ok: true, message: "Password changed." };
}

/* -------------------------------------------------------------------------- */
/* Addresses                                                                   */
/* -------------------------------------------------------------------------- */

const addressSchema = z.object({
  id: z.string().optional().or(z.literal("")),
  type: z.nativeEnum(AddressType).default(AddressType.HOME),
  fullName: z.string().trim().min(2, "Enter the recipient's name.").max(120),
  phone: z.string().trim().regex(PHONE_REGEX, "Enter a valid 10-digit Indian mobile number."),
  altPhone: z
    .string()
    .trim()
    .regex(PHONE_REGEX, "Enter a valid 10-digit Indian mobile number.")
    .optional()
    .or(z.literal("")),
  line1: z.string().trim().min(4, "Flat, house or building is required.").max(200),
  line2: z.string().trim().max(200).optional().or(z.literal("")),
  landmark: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(2, "City is required.").max(80),
  state: z.enum(INDIAN_STATES, { errorMap: () => ({ message: "Choose a state." }) }),
  pincode: z.string().trim().regex(PINCODE_REGEX, "Enter a valid 6-digit pincode."),
  isDefault: z.coerce.boolean().default(false),
});

export type AddressInput = z.infer<typeof addressSchema>;

function readAddress(formData: FormData) {
  return addressSchema.safeParse({
    id: formData.get("id") ?? "",
    type: formData.get("type") ?? AddressType.HOME,
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    altPhone: formData.get("altPhone") ?? "",
    line1: formData.get("line1"),
    line2: formData.get("line2") ?? "",
    landmark: formData.get("landmark") ?? "",
    city: formData.get("city"),
    state: formData.get("state"),
    pincode: formData.get("pincode"),
    isDefault: formData.get("isDefault") === "on" || formData.get("isDefault") === "true",
  });
}

export async function saveAddress(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();

  const parsed = readAddress(formData);
  if (!parsed.success) return { ok: false, message: "", fieldErrors: collectErrors(parsed.error) };

  const { id, isDefault, altPhone, line2, landmark, ...rest } = parsed.data;

  const data = {
    ...rest,
    altPhone: altPhone || null,
    line2: line2 || null,
    landmark: landmark || null,
  };

  const existingCount = await prisma.address.count({ where: { userId } });
  // The first address a customer saves is their default whether they ticked
  // the box or not — otherwise checkout has nothing pre-selected.
  const shouldDefault = isDefault || existingCount === 0;

  await prisma.$transaction(async (tx) => {
    if (shouldDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    if (id) {
      // Scope the update by userId so an id from another account can't be edited.
      const owned = await tx.address.findFirst({ where: { id, userId }, select: { id: true } });
      if (!owned) throw new Error("Address not found.");
      await tx.address.update({
        where: { id },
        data: { ...data, isDefault: shouldDefault },
      });
    } else {
      await tx.address.create({ data: { ...data, userId, isDefault: shouldDefault } });
    }
  });

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  return { ok: true, message: id ? "Address updated." : "Address saved." };
}

export async function deleteAddress(addressId: string): Promise<FormState> {
  const userId = await requireUserId();

  const address = await prisma.address.findFirst({
    where: { id: addressId, userId },
    select: { id: true, isDefault: true },
  });
  if (!address) return { ok: false, message: "Address not found." };

  await prisma.$transaction(async (tx) => {
    await tx.address.delete({ where: { id: address.id } });

    // Promote another address so the account is never left without a default.
    if (address.isDefault) {
      const next = await tx.address.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  return { ok: true, message: "Address removed." };
}

export async function setDefaultAddress(addressId: string): Promise<FormState> {
  const userId = await requireUserId();

  const owned = await prisma.address.findFirst({
    where: { id: addressId, userId },
    select: { id: true },
  });
  if (!owned) return { ok: false, message: "Address not found." };

  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.address.update({ where: { id: addressId }, data: { isDefault: true } }),
  ]);

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  return { ok: true, message: "Default address updated." };
}
