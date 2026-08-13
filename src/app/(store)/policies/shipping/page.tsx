import type { Metadata } from "next";
import { PolicyPage } from "@/components/policies/policy-page";
import { getStoreSettings } from "@/lib/settings";
import { formatPaise } from "@/lib/format";

export const metadata: Metadata = {
  title: "Shipping & delivery",
  description: "How Avenues orders are dispatched, tracked and delivered across India.",
};

export default async function ShippingPolicyPage() {
  const s = await getStoreSettings();

  return (
    <PolicyPage eyebrow="The fine print" title="Shipping & delivery" effectiveFrom="2026-08-01">
      <h2>Where we deliver</h2>
      <p>
        Everywhere in India that our courier partner, Delhivery, reaches — which
        is nearly every serviceable pincode in the country. Checkout verifies
        your pincode before payment, so you will never pay for an order we
        cannot deliver.
      </p>

      <h2>What it costs</h2>
      <ul>
        <li>
          Orders of {formatPaise(s.freeShippingThresholdPaise)} or more ship
          free.
        </li>
        <li>
          Below that, delivery is a flat {formatPaise(s.shippingFlatPaise)},
          shown clearly in your cart before you pay.
        </li>
        {s.codEnabled && (
          <li>
            Cash on delivery carries a {formatPaise(s.codFeePaise)} handling
            fee, added at checkout when you choose it.
          </li>
        )}
      </ul>

      <h2>How fast</h2>
      <p>
        Orders are dispatched within 24 to 48 hours of confirmation, Monday to
        Saturday. Delivery typically takes 2 to 5 working days for metros and 4
        to 8 working days elsewhere. These are estimates, not promises — the
        courier network occasionally has other plans, and festival seasons add a
        day or two.
      </p>

      <h2>Tracking</h2>
      <p>
        The moment your parcel is handed to Delhivery you receive an email with
        the AWB tracking number, and the live journey — packed, shipped, in
        transit, out for delivery, delivered — is visible on your order page at
        any time. No account needed: the tracking link in your email works on
        its own, or look your order up with its number and your email or phone.
      </p>

      <h2>If a parcel arrives damaged</h2>
      <p>
        Refuse visibly damaged parcels at the door if you can. If you discover
        damage after opening, photograph the parcel and bottle within 48 hours
        and write to {s.supportEmail} — we replace damaged bottles without
        argument.
      </p>

      <h2>Undeliverable parcels</h2>
      <p>
        If a parcel cannot be delivered — wrong address, repeatedly unavailable,
        refused — it returns to us. Prepaid orders are refunded in full once the
        return reaches us; we may deduct courier charges for repeated failed
        attempts on cash-on-delivery orders before accepting future COD orders
        from the same address.
      </p>
    </PolicyPage>
  );
}
