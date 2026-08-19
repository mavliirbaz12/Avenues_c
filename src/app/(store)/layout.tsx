import dynamic from "next/dynamic";
import { SiteNav } from "@/components/layout/site-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { SessionSync } from "@/components/providers/session-sync";
import { getStoreSettings, whatsappLink } from "@/lib/settings";
import { getNavFragrances } from "@/lib/catalog";

const MobileMenu = dynamic(
  () => import("@/components/layout/mobile-menu").then((m) => m.MobileMenu),
);
const SearchOverlay = dynamic(
  () => import("@/components/layout/search-overlay").then((m) => m.SearchOverlay),
);
const CartDrawer = dynamic(
  () => import("@/components/cart/cart-drawer").then((m) => m.CartDrawer),
);
const WhatsAppFab = dynamic(
  () => import("@/components/layout/whatsapp-fab").then((m) => m.WhatsAppFab),
);

/**
 * The storefront shell: announcement strip, nav, overlays, footer, channels.
 *
 * NOTHING HERE MAY READ THE REQUEST. Not cookies, not headers, not the session.
 *
 * This layout wraps every storefront route, so one dynamic API call in it opts
 * the whole group out of static generation — which is precisely what happened:
 * it awaited `getCurrentUser()` to hand `isAuthed` to the nav, and in exchange
 * every visit to /, /shop, /sets and every product page cost a fresh server
 * render plus database round-trips. Production answered `X-Vercel-Cache: MISS`
 * to literally every request at 1.3-3.1s a page, and the homepage's own
 * `revalidate = 3600` was dead code the entire time.
 *
 * Auth is now resolved on the client (src/store/session.ts), which is what
 * lets these pages be built once and served from the edge. The two reads that
 * remain are `unstable_cache`-wrapped catalogue queries — safe, because they
 * depend on the data, not on who is asking.
 */
export default async function StoreLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [settings, fragrances] = await Promise.all([
    getStoreSettings(),
    getNavFragrances(),
  ]);

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

      <SessionSync />

      {showAnnouncement && (
        <AnnouncementBar
          text={settings.announcementText!}
          href={settings.announcementHref}
        />
      )}

      <SiteNav fragrances={fragrances} />
      <MobileMenu
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

      <SiteFooter settings={settings} products={fragrances} />

      <CartDrawer />
      <WhatsAppFab href={wa} />
    </>
  );
}
