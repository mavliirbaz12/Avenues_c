import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { StoreHydrator } from "@/components/providers/store-hydrator";
import { siteUrl } from "@/lib/env";
import "./globals.css";

/**
 * Root layout: fonts, metadata and global providers only. The storefront
 * chrome (nav, footer, cart drawer, WhatsApp) lives in (store)/layout.tsx;
 * /admin renders its own back-of-house shell instead.
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh bg-ink text-bone">
        <StoreHydrator />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
