import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PaymentMethod, AddressType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { limitByIp } from "@/lib/rate-limit";
import { createOrder, OrderError } from "@/lib/commerce/orders";
import { INDIAN_STATES, PHONE_REGEX, PINCODE_REGEX } from "@/lib/constants/india";

export const dynamic = "force-dynamic";

const addressSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the recipient's name.").max(120),
  phone: z.string().trim().regex(PHONE_REGEX, "Enter a valid 10-digit Indian mobile number."),
  altPhone: z.string().trim().regex(PHONE_REGEX).optional().or(z.literal("")),
  line1: z.string().trim().min(4, "Flat, house or building is required.").max(200),
  line2: z.string().trim().max(200).optional().or(z.literal("")),
  landmark: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(2).max(80),
  state: z.enum(INDIAN_STATES),
  pincode: z.string().trim().regex(PINCODE_REGEX, "Enter a valid 6-digit pincode."),
});

const schema = z.object({
  items: z
    .array(z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(20) }))
    .min(1)
    .max(40),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z.string().trim().regex(PHONE_REGEX, "Enter a valid 10-digit Indian mobile number."),
  paymentMethod: z.nativeEnum(PaymentMethod),
  couponCode: z.string().trim().max(40).optional().nullable(),
  customerNote: z.string().trim().max(1000).optional().nullable(),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: "Please accept the terms to continue." }),
  }),
  // Either a saved address id (signed-in) or inline fields (guest / new).
  addressId: z.string().optional().nullable(),
  address: addressSchema.optional().nullable(),
  saveToBook: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const limit = await limitByIp("checkout", 10, 300_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ error: "Check the highlighted fields.", fieldErrors }, { status: 400 });
  }

  const session = await auth().catch(() => null);
  const userId = session?.user?.id ?? null;
  const body = parsed.data;

  // Resolve the delivery address. A saved id is only honoured for its owner —
  // and is re-read from the DB, never trusted from the client.
  let address: z.infer<typeof addressSchema>;
  if (body.addressId) {
    if (!userId) {
      return NextResponse.json({ error: "Sign in to use a saved address." }, { status: 401 });
    }
    const saved = await prisma.address.findFirst({
      where: { id: body.addressId, userId },
    });
    if (!saved) {
      return NextResponse.json({ error: "That address no longer exists." }, { status: 400 });
    }
    address = {
      fullName: saved.fullName,
      phone: saved.phone,
      altPhone: saved.altPhone ?? "",
      line1: saved.line1,
      line2: saved.line2 ?? "",
      landmark: saved.landmark ?? "",
      city: saved.city,
      state: saved.state as (typeof INDIAN_STATES)[number],
      pincode: saved.pincode,
    };
  } else if (body.address) {
    address = body.address;

    // "Save to address book" — best effort, never blocks the order.
    if (userId && body.saveToBook) {
      const count = await prisma.address.count({ where: { userId } });
      await prisma.address
        .create({
          data: {
            userId,
            type: AddressType.HOME,
            fullName: address.fullName,
            phone: address.phone,
            altPhone: address.altPhone || null,
            line1: address.line1,
            line2: address.line2 || null,
            landmark: address.landmark || null,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            isDefault: count === 0,
          },
        })
        .catch((err) => console.error("[checkout] saving address failed:", err));
    }
  } else {
    return NextResponse.json(
      { error: "A delivery address is required.", fieldErrors: { "address.line1": "Enter your address." } },
      { status: 400 },
    );
  }

  try {
    const result = await createOrder({
      intents: body.items,
      email: body.email,
      phone: body.phone,
      address: {
        fullName: address.fullName,
        phone: address.phone,
        altPhone: address.altPhone || null,
        line1: address.line1,
        line2: address.line2 || null,
        landmark: address.landmark || null,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
      },
      paymentMethod: body.paymentMethod,
      couponCode: body.couponCode ?? null,
      customerNote: body.customerNote ?? null,
      userId,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 409 });
    }
    console.error("[checkout] order creation failed:", err);
    return NextResponse.json(
      { error: "Something went wrong placing your order. You have not been charged." },
      { status: 500 },
    );
  }
}
