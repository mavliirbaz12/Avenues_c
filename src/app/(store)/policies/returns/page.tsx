import type { Metadata } from "next";
import { PolicyPage } from "@/components/policies/policy-page";
import { getStoreSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Returns, refunds & cancellation",
  description: "How to cancel an Avenues order, return a product, and receive your refund.",
};

export default async function ReturnsPolicyPage() {
  const s = await getStoreSettings();

  return (
    <PolicyPage
      eyebrow="The fine print"
      title="Returns, refunds & cancellation"
      effectiveFrom="2026-08-01"
    >
      <h2>Cancelling an order</h2>
      <p>
        You can cancel any order until it leaves us — while its status shows
        placed, confirmed or packed. Use the cancel button on your order page,
        or write to {s.supportEmail} quoting the order number. Once a parcel has
        shipped it can no longer be cancelled, but it can be returned after it
        arrives.
      </p>
      <p>
        Prepaid cancellations are refunded in full to the original payment
        method automatically. Banks typically post the credit within 5 to 7
        working days; UPI refunds are often same-day.
      </p>

      <h2>Returning a fragrance</h2>
      <p>
        Perfume is personal, and hygiene rules are unforgiving — so the policy
        is simple and honest:
      </p>
      <ul>
        <li>
          <strong>Unopened bottles</strong> — seal intact, cellophane
          undisturbed — can be returned within 7 days of delivery for a full
          refund. Request it from your order page and we arrange the pickup.
        </li>
        <li>
          <strong>Opened bottles</strong> cannot be returned or exchanged
          unless the product arrived damaged or is not what you ordered. This
          is a hygiene regulation, not a preference of ours.
        </li>
        <li>
          <strong>Damaged or wrong items</strong> — photograph the parcel and
          bottle within 48 hours of delivery and write to us. We replace or
          refund without a return in most cases.
        </li>
      </ul>

      <h2>How refunds work</h2>
      <ul>
        <li>Prepaid orders: refunded to the original payment method via Razorpay.</li>
        <li>
          Cash-on-delivery orders: refunded by bank transfer — we will ask for
          your account details securely over email.
        </li>
        <li>
          Refunds are initiated within 48 hours of the returned parcel reaching
          us and passing inspection.
        </li>
      </ul>

      <h2>What we do not accept</h2>
      <p>
        Products bought elsewhere, bottles with more than a few sprays used
        under a &ldquo;damaged&rdquo; claim, and returns requested after the
        7-day window. We read every request personally; honest problems get
        generous answers.
      </p>
    </PolicyPage>
  );
}
