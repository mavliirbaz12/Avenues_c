import Link from "next/link";
import { Mail, Phone, MessageCircle, Instagram, Facebook } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { GoldArc } from "@/components/brand/gold-arc";
import { NewsletterForm } from "@/components/forms/newsletter-form";
import { EnquiryForm } from "@/components/forms/enquiry-form";
import { whatsappLink } from "@/lib/settings";
import type { StoreSettings } from "@/lib/settings";

type NavFragrance = { slug: string; name: string };

const COMPANY = [
  { href: "/about", label: "Our story" },
  { href: "/contact", label: "Contact" },
  { href: "/track-order", label: "Track your order" },
  { href: "/account/orders", label: "Order history" },
];

const LEGAL = [
  { href: "/policies/shipping", label: "Shipping & delivery" },
  { href: "/policies/returns", label: "Returns & refunds" },
  { href: "/policies/privacy", label: "Privacy policy" },
  { href: "/policies/terms", label: "Terms of service" },
];

export function SiteFooter({
  settings,
  products,
}: {
  settings: StoreSettings;
  products: NavFragrance[];
}) {
  const wa = whatsappLink(
    settings.whatsappNumber,
    "Hi Avenues, I have a question.",
  );

  return (
    <footer className="relative mt-section border-t border-line bg-ink-deep grain">
      {/* Newsletter band */}
      <div className="shell relative z-[2] py-16 text-center sm:py-20">
        <GoldArc className="mb-10" />
        <p className="micro-label-gold">The letter</p>
        <h2 className="mx-auto mt-5 max-w-xl font-display text-d4 font-light text-bone">
          New fragrances, quietly announced
        </h2>
        <p className="mx-auto mt-4 max-w-md font-sans text-[0.9375rem] leading-relaxed text-stone">
          One email when something launches. Nothing else, and never your address
          shared with anyone.
        </p>
        <div className="mx-auto mt-8 max-w-sm">
          <NewsletterForm source="footer" />
        </div>
      </div>

      <div className="rule" />

      {/* Link columns */}
      <div className="shell relative z-[2] grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-4">
          <Logo size="md" showSubmark href={null} />
          <p className="mt-6 max-w-xs font-sans text-sm leading-relaxed text-stone">
            Eau de parfum, made in India. Built to be remembered
            rather than noticed.
          </p>

          <ul className="mt-7 space-y-3">
            <li>
              <a
                href={`mailto:${settings.supportEmail}`}
                className="inline-flex items-center gap-2.5 font-sans text-sm text-stone transition-colors hover:text-gold-light"
              >
                <Mail className="h-4 w-4 shrink-0 text-gold/70" strokeWidth={1.4} />
                {settings.supportEmail}
              </a>
            </li>
            {settings.supportPhone && (
              <li>
                <a
                  href={`tel:${settings.supportPhone.replace(/\s/g, "")}`}
                  className="inline-flex items-center gap-2.5 font-sans text-sm text-stone transition-colors hover:text-gold-light"
                >
                  <Phone className="h-4 w-4 shrink-0 text-gold/70" strokeWidth={1.4} />
                  {settings.supportPhone}
                </a>
              </li>
            )}
            {wa && (
              <li>
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 font-sans text-sm text-stone transition-colors hover:text-gold-light"
                >
                  <MessageCircle className="h-4 w-4 shrink-0 text-gold/70" strokeWidth={1.4} />
                  Message us on WhatsApp
                </a>
              </li>
            )}
          </ul>

          {(settings.instagramUrl || settings.facebookUrl) && (
            <div className="mt-7 flex items-center gap-3">
              {settings.instagramUrl && (
                <SocialLink href={settings.instagramUrl} label="Instagram">
                  <Instagram className="h-4 w-4" strokeWidth={1.4} />
                </SocialLink>
              )}
              {settings.facebookUrl && (
                <SocialLink href={settings.facebookUrl} label="Facebook">
                  <Facebook className="h-4 w-4" strokeWidth={1.4} />
                </SocialLink>
              )}
            </div>
          )}
        </div>

        <FooterColumn title="Fragrances" className="lg:col-span-2">
          {products.map((p) => (
            <FooterLink key={p.slug} href={`/fragrance/${p.slug}`}>
              {p.name.replace(/^Avenues\s+/, "")}
            </FooterLink>
          ))}
          <FooterLink href="/shop">Shop all</FooterLink>
        </FooterColumn>

        <FooterColumn title="Company" className="lg:col-span-2">
          {COMPANY.map((l) => (
            <FooterLink key={l.href} href={l.href}>
              {l.label}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title="Legal" className="lg:col-span-2">
          {LEGAL.map((l) => (
            <FooterLink key={l.href} href={l.href}>
              {l.label}
            </FooterLink>
          ))}
        </FooterColumn>

        <div className="sm:col-span-2 lg:col-span-2">
          <h3 className="micro-label mb-5">Ask us anything</h3>
          <EnquiryForm compact source="footer" defaultSubject="OTHER" />
        </div>
      </div>

      <div className="rule" />

      {/* Statutory strip */}
      <div className="shell relative z-[2] flex flex-col gap-4 py-8 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p className="font-sans text-xs leading-relaxed text-stone-dark">
          &copy; {new Date().getFullYear()} {settings.manufacturerName}. All rights reserved.
          {settings.gstin && <> &middot; GSTIN {settings.gstin}</>}
        </p>
        <p className="font-sans text-xs text-stone-dark">
          Country of origin: India &middot; Prices inclusive of all taxes
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <h3 className="micro-label mb-5">{title}</h3>
      <ul className="space-y-3">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="font-sans text-sm text-stone transition-colors duration-300 hover:text-gold-light"
      >
        {children}
      </Link>
    </li>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center border border-line text-stone
                 transition-colors duration-300 ease-smoke hover:border-gold/40 hover:text-gold-light"
    >
      {children}
    </a>
  );
}
