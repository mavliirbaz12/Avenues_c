import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import type { SavedAddress } from "@/components/account/address-book";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-guards";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your Avenues order.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const sessionUser = await getCurrentUser();

  let user: { name: string; email: string; phone: string } | null = null;
  let savedAddresses: SavedAddress[] = [];

  if (sessionUser) {
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
    savedAddresses = rows.map((a) => ({
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
  }

  return (
    <div className="shell py-12 sm:py-16">
      <header className="mb-10">
        <p className="micro-label-gold">Nearly there</p>
        <h1 className="mt-4 font-display text-d3 font-light text-bone">Checkout</h1>
        {!user && (
          <p className="mt-3 font-sans text-sm text-stone">
            Checking out as a guest.{" "}
            <Link
              href="/login?next=/checkout"
              className="text-gold underline underline-offset-4 transition-colors hover:text-gold-light"
            >
              Sign in
            </Link>{" "}
            to use saved addresses — or don&rsquo;t, no account is required.
          </p>
        )}
      </header>

      <CheckoutForm user={user} savedAddresses={savedAddresses} />
    </div>
  );
}
