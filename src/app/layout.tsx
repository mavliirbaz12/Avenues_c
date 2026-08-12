import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { SiteNav } from "@/components/layout/site-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { SearchOverlay } from "@/components/layout/search-overlay";
import { WhatsAppFab } from "@/components/layout/whatsapp-fab";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { Toaster } from "@/components/ui/toaster";
import { StoreHydrator } from "@/components/providers/store-hydrator";
import { SessionSync } from "@/components/providers/session-sync";
import { getCurrentUser } from "@/lib/auth-guards";
import { getStoreSettings, whatsappLink } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/env";
import "./globals.css";

/**
 * Type pairing: a high-contrast display serif with the engraved feel of the
 * logo, against a geometric sans that stays quiet in UI. Only the weights the
 * site actually uses are requested — every extra weight is a font file.
 */
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const sans = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Avenues — Eau de parfum, made in India",
    template: "%s · Avenues",
  },
  description:
    "Five eau de parfum fragrances built to be remembered rather than noticed. 50ml, 8 to 10 hours of wear, delivered across India.",
  applicationName: "Avenues",
  keywords: [
    "Avenues Perfumes",
    "eau de parfum India",
    "luxury perfume India",
    "oud perfume",
    "long lasting perfume",
  ],
  openGraph: {
    type: "website",
    siteName: "Avenues",
    locale: "en_IN",
    url: siteUrl,
    title: "Avenues — Eau de parfum, made in India",
    description:
      "Five fragrances built to be remembered rather than noticed. 50ml eau de parfum.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Avenues — Eau de parfum, made in India",
    description:
      "Five fragrances built to be remembered rather than noticed. 50ml eau de parfum.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0B0B0D",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [settings, fragrances, user] = await Promise.all([
    getStoreSettings(),
    prisma.product
      .findMany({
        where: { isActive: true },
        select: { slug: true, name: true },
        orderBy: { sortOrder: "asc" },
        take: 8,
      })
      .catch(() => []),
    getCurrentUser().catch(() => null),
  ]);

  const isAuthed = Boolean(user);
  const wa = whatsappLink(settings.whatsappNumber, "Hi Avenues, I have a question.");

  return (
    <html lang="en-IN" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh bg-ink text-bone">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100]
                     focus:border focus:border-gold focus:bg-ink focus:px-5 focus:py-3
                     focus:font-sans focus:text-micro focus:uppercase focus:text-gold"
        >
          Skip to content
        </a>

        <StoreHydrator />
        <SessionSync isAuthed={isAuthed} />
        <SiteNav isAuthed={isAuthed} />
        <MobileMenu
          isAuthed={isAuthed}
          supportEmail={settings.supportEmail}
          whatsappHref={wa}
          fragrances={fragrances}
        />
        <SearchOverlay />

        <main id="main" className="pt-[var(--nav-h)]">
          {children}
        </main>

        <SiteFooter />

        <CartDrawer />
        <WhatsAppFab href={wa} />
        <Toaster />
      </body>
    </html>
  );
}
