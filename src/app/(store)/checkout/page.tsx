import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import type { SavedAddress } from "@/components/account/address-book";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your Avenues order.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * CHECKOUT REQUIRES AN ACCOUNT.
 *
 * Guest checkout used to be allowed here. Requiring sign-in is a deliberate
 * trade — it costs some conversion — but it is also what makes several controls
 * meaningful: a coupon's "uses per customer" cap needs a customer to count
 * against, and an order with an owner cannot later be claimed by whoever
 * registers that email address first.
 *
 * The redirect preserves the destination, so signing in drops the customer back
 * on checkout with their cart intact (the cart lives client-side and is merged
 * on login by SessionSync). Enforcement is repeated in POST /api/checkout — a
 * page guard is a courtesy to the browser, not a security boundary.
 */
export default async function CheckoutPage() {
  const sessionUser = await requireUser("/checkout");

  let user: { name: string; email: string; phone: string } | null = null;

  const [dbUser, rows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { name: true, email: true, phone: true },
    }),
    prisma.address.findMany({
      where: { userId: sessionUser.id },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    }),
  ]);

  if (dbUser) {
    // A phone-OTP account may have no email yet — checkout's email field
    // starts empty and the address they type gets captured on the order.
    user = { name: dbUser.name ?? "", email: dbUser.email ?? "", phone: dbUser.phone ?? "" };
  }
  const savedAddresses: SavedAddress[] = rows.map((a) => ({
    id: a.id,
    type: a.type,
    fullName: a.fullName,
    phone: a.phone,
    altPhone: a.altPhone,
    line1: a.line1,
    line2: a.line2,
    landmark: a.landmark,
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    isDefault: a.isDefault,
  }));

  return (
    <div className="shell py-12 sm:py-16">
      <header className="mb-10">
        <p className="micro-label-gold">Nearly there</p>
        <h1 className="mt-4 font-display text-d3 font-light text-bone">Checkout</h1>
      </header>

      <CheckoutForm user={user} savedAddresses={savedAddresses} />
    </div>
  );
}
