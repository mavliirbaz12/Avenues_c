import { SiteNav } from "@/components/layout/site-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { SearchOverlay } from "@/components/layout/search-overlay";
import { WhatsAppFab } from "@/components/layout/whatsapp-fab";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { SessionSync } from "@/components/providers/session-sync";
import { getCurrentUser } from "@/lib/auth-guards";
import { getStoreSettings, whatsappLink } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

/** The storefront shell: nav, overlays, footer, floating channels. */
export default async function StoreLayout({
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
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100]
                   focus:border focus:border-gold focus:bg-ink focus:px-5 focus:py-3
                   focus:font-sans focus:text-micro focus:uppercase focus:text-gold"
      >
        Skip to content
      </a>

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
    </>
  );
}
