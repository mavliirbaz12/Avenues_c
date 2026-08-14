"use server";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { limitByIp } from "@/lib/rate-limit";
import { sendEmail, emailShell, escapeHtml } from "@/lib/email";
import { claimGuestOrders } from "@/lib/commerce/claim-orders";
import { siteUrl } from "@/lib/env";
import type { FormState } from "@/lib/form-state";

const password = z
  .string()
  .min(8, "At least 8 characters.")
  .max(200)
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

/* -------------------------------------------------------------------------- */
/* Sign up                                                                     */
/* -------------------------------------------------------------------------- */

const signupSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?91[-\s]?)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number.")
    .optional()
    .or(z.literal("")),
  password,
});

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const limit = await limitByIp("signup", 6, 600_000);
  if (!limit.ok) {
    return { ok: false, message: `Too many attempts. Try again in ${limit.retryAfter}s.` };
  }

  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "", fieldErrors };
  }

  const { name, email, phone, password: raw } = parsed.data;
  const passwordHash = await bcrypt.hash(raw, 12);

  try {
    const user = await prisma.user.create({
      data: { name, email, phone: phone || null, passwordHash, role: "CUSTOMER" },
      select: { id: true, email: true },
    });

    // Anything they bought as a guest with this address becomes theirs.
    await claimGuestOrders(user.id, user.email).catch(() => {});

    await sendEmail({
      to: email,
      subject: "Welcome to Avenues",
      html: emailShell({
        preheader: "Your account is ready.",
        heading: `Welcome, ${escapeHtml(name.split(" ")[0] ?? name)}`,
        body: `
          <p>Your account is ready. You can now track orders, save addresses and
          keep a wishlist of what you're deciding between.</p>
          <p>If you ordered as a guest with this address, those orders are already
          waiting in your history.</p>`,
        cta: { label: "Start with the five", href: `${siteUrl}/shop` },
      }),
    });

    return { ok: true, message: "Account created." };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return {
        ok: false,
        message: "",
        fieldErrors: { email: "An account with this email already exists." },
      };
    }
    console.error("[signup] failed:", err);
    return { ok: false, message: "Something went wrong. Try again in a moment." };
  }
}

/* -------------------------------------------------------------------------- */
/* Forgot / reset password                                                     */
/* -------------------------------------------------------------------------- */

const RESET_TTL_MS = 60 * 60 * 1000; // one hour

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const limit = await limitByIp("reset-request", 5, 900_000);
  if (!limit.ok) {
    return { ok: false, message: `Too many attempts. Try again in ${limit.retryAfter}s.` };
  }

  const parsed = z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .safeParse(formData.get("email"));

  // Always report success. Telling the caller whether an address is registered
  // turns this form into an account-enumeration oracle.
  const generic: FormState = {
    ok: true,
    message: "If that address has an account, a reset link is on its way.",
  };

  if (!parsed.success) return generic;

  const user = await prisma.user.findUnique({
    where: { email: parsed.data },
    select: { id: true, email: true, name: true, passwordHash: true },
  });

  // OAuth-only accounts have no password to reset.
  if (!user || !user.passwordHash) return generic;

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  // Invalidate outstanding tokens so only the newest link works.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expires: new Date(Date.now() + RESET_TTL_MS) },
  });

  const link = `${siteUrl}/reset-password?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: "Reset your Avenues password",
    html: emailShell({
      preheader: "This link works for one hour.",
      heading: "Reset your password",
      body: `
        <p>Someone asked to reset the password on this account. If that was you,
        use the button below — the link works for one hour and once only.</p>
        <p style="color:#6B655D;font-size:13px;">If it wasn't you, ignore this email.
        Your password has not changed.</p>`,
      cta: { label: "Choose a new password", href: link },
      footerNote: "If the button doesn't work, paste this into your browser: " + link,
    }),
  });

  return generic;
}

const resetSchema = z
  .object({
    token: z.string().min(16),
    password,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Both passwords must match.",
    path: ["confirm"],
  });

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const limit = await limitByIp("reset-submit", 10, 900_000);
  if (!limit.ok) {
    return { ok: false, message: `Too many attempts. Try again in ${limit.retryAfter}s.` };
  }

  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "", fieldErrors };
  }

  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expires: true, usedAt: true },
  });

  if (!record || record.usedAt || record.expires < new Date()) {
    return {
      ok: false,
      message: "That link has expired or already been used. Request a new one.",
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Signing out everywhere is the point of a reset — a stolen session must
    // not survive it.
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);

  return { ok: true, message: "Password updated. You can sign in now." };
}
