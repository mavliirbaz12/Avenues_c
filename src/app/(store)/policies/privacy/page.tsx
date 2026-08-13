import type { Metadata } from "next";
import { PolicyPage } from "@/components/policies/policy-page";
import { getStoreSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What Avenues collects, why, and what we will never do with it.",
};

export default async function PrivacyPolicyPage() {
  const s = await getStoreSettings();

  return (
    <PolicyPage eyebrow="The fine print" title="Privacy policy" effectiveFrom="2026-08-01">
      <p>
        The short version: we collect what a shop needs to sell you perfume and
        deliver it, we do not sell your data to anyone, and you can ask us to
        delete your account at any time.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Order details</strong> — name, delivery address, email, phone,
          and what you bought. Needed to fulfil the contract you make with us at
          checkout.
        </li>
        <li>
          <strong>Account details</strong> — email, name, a hashed password (we
          cannot read it), saved addresses and wishlist. Only if you create an
          account; guest checkout is always available.
        </li>
        <li>
          <strong>Payment</strong> — handled entirely by Razorpay. Your card or
          UPI details never touch our servers; we store only the payment
          reference and status.
        </li>
        <li>
          <strong>Messages</strong> — enquiries you send us and reviews you
          write.
        </li>
        <li>
          <strong>Analytics</strong> — if enabled, standard web analytics
          (pages visited, device type) to understand what is worth improving.
        </li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        Only the services that make the shop function: Razorpay (payment),
        Delhivery (your name, address and phone, so the parcel finds you), our
        email provider (to send receipts and tracking updates), and our hosting
        infrastructure. Each receives the minimum needed for its job. We never
        sell or rent your information, and we do not send marketing email
        unless you subscribed to the newsletter — which is one click to leave.
      </p>

      <h2>Cookies</h2>
      <p>
        A session cookie if you sign in, and your cart and wishlist stored in
        your own browser. No cross-site advertising trackers are set unless an
        analytics or ads pixel is explicitly enabled, and any such tool is
        listed on this page when it is.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Order and invoice records are kept as long as Indian tax law requires.
        Account data lives until you delete the account. Enquiries are kept for
        two years so we have context if you write again.
      </p>

      <h2>Your rights</h2>
      <p>
        Ask us what we hold about you, correct it, or have your account and
        non-statutory data deleted — one email to {s.customerCareEmail} does
        it. We respond within 30 days, usually much faster.
      </p>

      <h2>Contact</h2>
      <p>
        {s.manufacturerName}
        {s.manufacturerAddress && <> · {s.manufacturerAddress}</>} ·{" "}
        {s.customerCareEmail}
      </p>
    </PolicyPage>
  );
}
