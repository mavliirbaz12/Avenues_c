import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/toaster";
import { StoreHydrator } from "@/components/providers/store-hydrator";
import { Analytics } from "@/components/analytics/analytics";
import { siteUrl } from "@/lib/env";
import "./globals.css";

/**
 * Root layout: fonts, metadata and global providers only. The storefront
 * chrome (nav, footer, cart drawer, WhatsApp) lives in (store)/layout.tsx;
 * /admin renders its own back-of-house shell instead.
 */
/**
 * Fonts are SELF-HOSTED, not fetched from Google at build time.
 *
 * `next/font/google` downloads the files during the build. That is a network
 * dependency in the one place a failure is silent: if the fetch times out —
 * which it did here — Next logs a warning, substitutes a system fallback and
 * builds successfully. The site ships in Arial and nobody notices until someone
 * looks at it, which for a brand whose identity is its typography is the worst
 * possible failure mode.
 *
 * Both families ship as variable fonts, so one file covers every weight and the
 * italic is a second file. 112KB for the pair, latin subset.
 */
const display = localFont({
  src: [
    { path: "./fonts/cormorant.woff2", style: "normal", weight: "300 700" },
    { path: "./fonts/cormorant-italic.woff2", style: "italic", weight: "300 700" },
  ],
  variable: "--font-display",
  display: "swap",
  // Measured against the real face so the fallback swap does not reflow.
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const sans = localFont({
  src: [{ path: "./fonts/jost.woff2", style: "normal", weight: "300 700" }],
  variable: "--font-sans",
  display: "swap",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Avenues — Eau de parfum, made in India",
    template: "%s · Avenues",
  },
  description:
    "Eau de parfum built to be remembered rather than noticed. Eight to ten hours of wear, delivered across India.",
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
      "Eau de parfum, built to be remembered rather than noticed.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Avenues — Eau de parfum, made in India",
    description:
      "Eau de parfum, built to be remembered rather than noticed.",
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
        <Analytics />
      </body>
    </html>
  );
}
