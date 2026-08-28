import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Phone, Clock, Package, ArrowRight } from "lucide-react";
import { EnquiryForm } from "@/components/forms/enquiry-form";
import { GoldArc } from "@/components/brand/gold-arc";
import { Reveal } from "@/components/motion/reveal";
import { getStoreSettings, whatsappLink } from "@/lib/settings";
import { siteUrl } from "@/lib/env";
import { WhatsAppIcon } from "@/components/icons/whatsapp";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Write to Avenues about an order, a product, or a bulk enquiry — we reply within 24 hours.",
  alternates: { canonical: `${siteUrl}/contact` },
};

/**
 * The three questions that arrive most often, answered here so they do not
 * arrive at all. Deliberately short — an FAQ that needs scrolling is a second
 * page, not an answer.
 */
const FAQS = [
  {
    q: "How long does delivery take?",
    a: "Orders leave us within 24 to 48 hours. Delhivery then takes two to five days depending on your pincode, and you get a tracking link by email the moment the label is made.",
  },
  {
    q: "Is cash on delivery available?",
    a: "Yes, across India wherever Delhivery services the pincode. You can check yours at checkout before paying anything.",
  },
  {
    q: "Can I return a fragrance I do not like?",
    a: "Sealed bottles can be returned within the window set out in our returns policy. Once a bottle is opened we cannot resell it, so opened returns are handled case by case — write to us and a person will look at it.",
  },
] as const;

export default async function ContactPage() {
  const settings = await getStoreSettings();
  const wa = whatsappLink(settings.whatsappNumber, "Hi Avenues, I have a question.");

  return (
    <div className="shell py-14 sm:py-20">
      <header className="mx-auto max-w-xl text-center">
        <Reveal>
          <p className="micro-label-gold">Contact</p>
          <h1 className="mt-5 font-display text-d2 font-light text-bone">
            A person answers
          </h1>
          <p className="mx-auto mt-5 max-w-md font-sans text-body-lg leading-relaxed text-stone">
            Order trouble, fragrance advice, bulk and corporate orders — write
            and a human replies within 24 hours. Usually much sooner.
          </p>
        </Reveal>
        <GoldArc className="mt-10" />
      </header>

      {/*
        ANSWER IT BEFORE THEY ASK IT.

        Most contact-page traffic is a question the site can already answer, and
        "where is my order" is the biggest of them by a distance. This page had
        no route to /track-order at all: someone with a delivery question filled
        in a form and waited a day for something they could have had in ten
        seconds. The same is true of delivery timelines and returns, both of
        which are written out in the policies.

        So the fastest answers come first and the form stays underneath for
        everything genuinely new. It is fewer messages to answer and a better
        experience — the customer is not waiting on a human for a fact.
      */}
      <div className="mx-auto mt-12 max-w-4xl border border-line bg-surface/40 p-6 sm:p-8">
        <p className="micro-label-gold">Fastest answers</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Link
            href="/track-order"
            className="group flex items-center justify-between gap-3 border border-line px-4 py-3.5
                       font-sans text-sm text-bone transition-colors hover:border-gold/40 hover:text-gold-light"
          >
            <span className="flex items-center gap-2.5">
              <Package className="h-4 w-4 text-gold/70" strokeWidth={1.4} />
              Track your order
            </span>
            <ArrowRight
              className="h-3.5 w-3.5 shrink-0 transition-transform duration-500 ease-smoke group-hover:translate-x-0.5"
              strokeWidth={1.6}
            />
          </Link>

          <Link
            href="/policies/shipping"
            className="flex items-center gap-2.5 border border-line px-4 py-3.5 font-sans text-sm
                       text-bone transition-colors hover:border-gold/40 hover:text-gold-light"
          >
            Delivery &amp; timelines
          </Link>

          <Link
            href="/policies/returns"
            className="flex items-center gap-2.5 border border-line px-4 py-3.5 font-sans text-sm
                       text-bone transition-colors hover:border-gold/40 hover:text-gold-light"
          >
            Returns &amp; refunds
          </Link>
        </div>

        {/* An accordion, not prose: three answers cost three lines of height
            until someone wants one. The same reason the reference stores put
            their FAQ behind a summary rather than on the page. */}
        <div className="mt-6 divide-y divide-line border-t border-line">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-3.5">
              <summary
                className="flex cursor-pointer list-none items-center justify-between gap-4
                           font-sans text-sm text-bone transition-colors hover:text-gold-light"
              >
                {f.q}
                <span
                  aria-hidden="true"
                  className="text-gold/60 transition-transform duration-300 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-2.5 font-sans text-[0.9375rem] leading-relaxed text-stone">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-12 lg:grid-cols-5 lg:gap-16">
        <Reveal className="lg:col-span-2">
          <ul className="space-y-6">
            <Channel
              icon={<Mail className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.4} />}
              label="Email"
              detail="For anything, any time."
            >
              <a href={`mailto:${settings.supportEmail}`} className="text-gold transition-colors hover:text-gold-light">
                {settings.supportEmail}
              </a>
            </Channel>

            {wa && (
              <Channel
                icon={<WhatsAppIcon className="h-[1.1rem] w-[1.1rem]" />}
                label="WhatsApp"
                detail="Fastest for order updates."
              >
                <a href={wa} target="_blank" rel="noopener noreferrer" className="text-gold transition-colors hover:text-gold-light">
                  Message us
                </a>
              </Channel>
            )}

            {settings.supportPhone && (
              <Channel
                icon={<Phone className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.4} />}
                label="Phone"
                detail="Mon–Sat, 10am to 6pm IST."
              >
                <a href={`tel:${settings.supportPhone.replace(/\s/g, "")}`} className="text-gold transition-colors hover:text-gold-light">
                  {settings.supportPhone}
                </a>
              </Channel>
            )}

            <Channel
              icon={<Clock className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.4} />}
              label="Response time"
              detail="Every message gets a human reply within 24 hours."
            />
          </ul>
        </Reveal>

        <Reveal delay={0.08} className="lg:col-span-3">
          <EnquiryForm source="contact-page" />
        </Reveal>
      </div>
    </div>
  );
}

function Channel({
  icon,
  label,
  detail,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-4 border-b border-line pb-6 last:border-0">
      <span className="mt-0.5 text-gold/70">{icon}</span>
      <div>
        <p className="micro-label">{label}</p>
        {children && <p className="mt-1.5 font-sans text-[0.9375rem]">{children}</p>}
        <p className="mt-1 font-sans text-xs leading-relaxed text-stone-dark">{detail}</p>
      </div>
    </li>
  );
}
