import { SiteNav } from "@/components/layout/site-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { SearchOverlay } from "@/components/layout/search-overlay";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { WhatsAppFab } from "@/components/layout/whatsapp-fab";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { SessionSync } from "@/components/providers/session-sync";
import { getCurrentUser } from "@/lib/auth-guards";
import { getStoreSettings, whatsappLink } from "@/lib/settings";
import { getNavFragrances } from "@/lib/catalog";

/** The storefront shell: announcement strip, nav, overlays, footer, channels. */
export default async function StoreLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [settings, fragrances, user] = await Promise.all([
    getStoreSettings(),
    getNavFragrances(),
    getCurrentUser().catch(() => null),
  ]);

  const isAuthed = Boolean(user);
  const wa = whatsappLink(settings.whatsappNumber, "Hi Avenues, I have a question.");
  const showAnnouncement = Boolean(settings.announcementEnabled && settings.announcementText);

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

      {showAnnouncement && (
        <AnnouncementBar
          text={settings.announcementText!}
          href={settings.announcementHref}
        />
      )}

      <SiteNav
        isAuthed={isAuthed}
        firstName={user?.name?.split(" ")[0] ?? null}
        fragrances={fragrances}
      />
      <MobileMenu
        isAuthed={isAuthed}
        supportEmail={settings.supportEmail}
        whatsappHref={wa}
        fragrances={fragrances}
      />
      <SearchOverlay />

      {/* --header-h is nav + announcement strip; the landing hero cancels the
          same value to bleed under the fixed chrome. */}
      <main id="main" className="pt-[var(--header-h)]">
        {children}
      </main>

      <SiteFooter />

      <CartDrawer />
      <WhatsAppFab href={wa} />
    </>
  );
}
