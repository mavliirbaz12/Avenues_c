import type { Metadata } from "next";
import { Mail, Phone, MessageCircle, Clock } from "lucide-react";
import { EnquiryForm } from "@/components/forms/enquiry-form";
import { GoldArc } from "@/components/brand/gold-arc";
import { Reveal } from "@/components/motion/reveal";
import { getStoreSettings, whatsappLink } from "@/lib/settings";
import { siteUrl } from "@/lib/env";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Write to Avenues about an order, a product, or a bulk enquiry — we reply within 24 hours.",
  alternates: { canonical: `${siteUrl}/contact` },
};

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
                icon={<MessageCircle className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.4} />}
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
