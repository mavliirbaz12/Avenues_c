import type { Metadata } from "next";
import { PolicyPage } from "@/components/policies/policy-page";
import { getStoreSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms that govern buying from Avenues.",
};

export default async function TermsPage() {
  const s = await getStoreSettings();

  return (
    <PolicyPage eyebrow="The fine print" title="Terms of service" effectiveFrom="2026-08-01">
      <p>
        These terms govern your use of this website and every purchase made on
        it. Placing an order means you accept them. They are written to be
        read, not to intimidate — if anything is unclear, ask us before you
        buy.
      </p>

      <h2>Who you are buying from</h2>
      <p>
        {s.manufacturerName}
        {s.manufacturerAddress && <>, {s.manufacturerAddress}</>}
        {s.gstin && <> · GSTIN {s.gstin}</>}. &ldquo;We&rdquo;, &ldquo;us&rdquo;
        and &ldquo;Avenues&rdquo; refer to this business.
      </p>

      <h2>Orders & pricing</h2>
      <ul>
        <li>
          All prices are in Indian rupees and inclusive of all taxes. The price
          charged is the price shown at checkout at the moment you pay.
        </li>
        <li>
          An order is accepted when we confirm it by email. We may refuse or
          cancel orders for suspected fraud, pricing errors, or stock errors —
          anything already paid is refunded in full.
        </li>
        <li>
          Obvious pricing mistakes (a bottle listed at ₹9 instead of ₹999) do
          not become contracts by being checked out quickly.
        </li>
      </ul>

      <h2>Payment</h2>
      <p>
        Online payments are processed by Razorpay under their terms. Cash on
        delivery, where offered, must be paid in full to the courier before the
        parcel is handed over.
      </p>

      <h2>Delivery, returns & cancellation</h2>
      <p>
        Covered in detail by the shipping policy and the returns policy, both of
        which form part of these terms.
      </p>

      <h2>Using the product</h2>
      <p>
        Our fragrances are for external cosmetic use. Read the caution text on
        the product page and packaging; patch test if you have sensitive skin.
        We are not liable for reactions arising from use contrary to those
        instructions.
      </p>

      <h2>Accounts & reviews</h2>
      <ul>
        <li>Keep your password to yourself; activity on your account is yours.</li>
        <li>
          Reviews must be your genuine experience. We moderate before
          publication and remove abuse, spam and reviews of products not bought
          or worn.
        </li>
      </ul>

      <h2>Our content</h2>
      <p>
        The Avenues name, monogram, photography and copy are ours. Do not reuse
        them commercially without written permission.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, our liability for any claim connected to
        an order is limited to the amount you paid for it. Nothing in these
        terms limits liability that cannot be limited under Indian law.
      </p>

      <h2>Disputes</h2>
      <p>
        These terms are governed by the laws of India. Talk to us first —
        {" "}{s.customerCareEmail} — almost everything resolves in one email.
        Failing that, disputes fall under the jurisdiction of the courts at our
        registered place of business.
      </p>
    </PolicyPage>
  );
}
