"use server";

import { z } from "zod";
import { Prisma, EnquirySubject } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { limitByIp } from "@/lib/rate-limit";
import { sendEmail, emailShell, escapeHtml } from "@/lib/email";
import { getStoreSettings } from "@/lib/settings";
import { env } from "@/lib/env";

export type ActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

export const IDLE: ActionState = { ok: false, message: "" };

/* -------------------------------------------------------------------------- */
/* Newsletter                                                                  */
/* -------------------------------------------------------------------------- */

const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  source: z.string().optional(),
});

export async function subscribeNewsletter(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const limit = await limitByIp("newsletter", 5, 60_000);
  if (!limit.ok) {
    return { ok: false, message: `Too many attempts. Try again in ${limit.retryAfter}s.` };
  }

  const parsed = newsletterSchema.safeParse({
    email: formData.get("email"),
    source: formData.get("source"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "",
      fieldErrors: { email: parsed.error.issues[0]?.message ?? "Enter a valid email address." },
    };
  }

  try {
    await prisma.newsletterSubscriber.create({
      data: { email: parsed.data.email, source: parsed.data.source ?? "footer" },
    });
  } catch (err) {
    // Already subscribed — say the same thing either way rather than leaking
    // whether an address is on the list.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
      console.error("[newsletter] failed:", err);
      return { ok: false, message: "Something went wrong. Try again in a moment." };
    }
  }

  return { ok: true, message: "You're on the list. Watch for the first letter." };
}

/* -------------------------------------------------------------------------- */
/* Enquiries                                                                   */
/* -------------------------------------------------------------------------- */

const SUBJECTS = ["ORDER_ISSUE", "PRODUCT_ENQUIRY", "BULK_CORPORATE", "OTHER"] as const;

export const SUBJECT_LABELS: Record<(typeof SUBJECTS)[number], string> = {
  ORDER_ISSUE: "Order issue",
  PRODUCT_ENQUIRY: "Product enquiry",
  BULK_CORPORATE: "Bulk & corporate order",
  OTHER: "Other",
};

const enquirySchema = z.object({
  name: z.string().trim().min(2, "Tell us your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?91[-\s]?)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number.")
    .optional()
    .or(z.literal("")),
  subject: z.enum(SUBJECTS).default("OTHER"),
  message: z.string().trim().min(10, "A little more detail, please.").max(4000),
  source: z.string().optional(),
});

export async function submitEnquiry(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const limit = await limitByIp("enquiry", 4, 300_000);
  if (!limit.ok) {
    return {
      ok: false,
      message: `You've sent a few already. Try again in ${Math.ceil(limit.retryAfter / 60)} min.`,
    };
  }

  const parsed = enquirySchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    subject: formData.get("subject") ?? "OTHER",
    message: formData.get("message"),
    source: formData.get("source"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "", fieldErrors };
  }

  const { name, email, phone, subject, message, source } = parsed.data;

  let enquiry;
  try {
    enquiry = await prisma.enquiry.create({
      data: {
        name,
        email,
        phone: phone || null,
        subject: subject as EnquirySubject,
        message,
        source: source ?? "contact-page",
      },
    });
  } catch (err) {
    console.error("[enquiry] failed to save:", err);
    return { ok: false, message: "Something went wrong. Try again in a moment." };
  }

  const settings = await getStoreSettings();
  const adminInbox = env.EMAIL_ADMIN || settings.supportEmail;

  // Notify the store, and acknowledge to the customer. Neither can fail the
  // action — the enquiry is already safely in the database.
  await Promise.allSettled([
    sendEmail({
      to: adminInbox,
      replyTo: email,
      subject: `New enquiry — ${SUBJECT_LABELS[subject]} — ${name}`,
      html: emailShell({
        preheader: `${SUBJECT_LABELS[subject]} from ${name}`,
        heading: "New enquiry",
        body: `
          <p><strong style="color:#F2EDE3;">${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt;${
            phone ? ` &middot; ${escapeHtml(phone)}` : ""
          }</p>
          <p><strong style="color:#F2EDE3;">Subject:</strong> ${SUBJECT_LABELS[subject]}</p>
          <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>`,
        footerNote: `Reference ${enquiry.id}`,
      }),
    }),
    sendEmail({
      to: email,
      subject: "We've received your message — Avenues",
      html: emailShell({
        preheader: "We reply within 24 hours.",
        heading: `Thank you, ${escapeHtml(name.split(" ")[0] ?? name)}`,
        body: `
          <p>Your message has reached us. Someone will reply within 24 hours — usually sooner.</p>
          <p style="color:#6B655D;">For reference, here is what you sent:</p>
          <p style="white-space:pre-wrap;border-left:2px solid #232327;padding-left:14px;">${escapeHtml(message)}</p>`,
        footerNote: settings.supportPhone
          ? `In a hurry? Call ${settings.supportPhone}.`
          : undefined,
      }),
    }),
  ]);

  return {
    ok: true,
    message: "Message received. We reply within 24 hours.",
  };
}
