import type { Metadata } from "next";
import { AddressBook, type SavedAddress } from "@/components/account/address-book";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";

export const metadata: Metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");

  const rows = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  const addresses: SavedAddress[] = rows.map((a) => ({
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
    <div>
      <header>
        <h2 className="font-display text-d5 font-light text-bone">Address book</h2>
        <p className="mt-2 font-sans text-sm text-stone">
          Your default address is pre-selected at checkout.
        </p>
      </header>

      <div className="mt-8">
        <AddressBook addresses={addresses} />
      </div>
    </div>
  );
}
