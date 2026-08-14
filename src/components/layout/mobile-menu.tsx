"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X, Search, Heart, User, Mail, MessageCircle } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Sparkle } from "@/components/brand/sparkle";
import { NAV_LINKS } from "./nav-links";
import { useUI } from "@/store/ui";
import { useWishlist } from "@/store/wishlist";

export function MobileMenu({
  isAuthed,
  supportEmail,
  whatsappHref,
  fragrances,
}: {
  isAuthed: boolean;
  supportEmail: string;
  whatsappHref: string | null;
  fragrances: { slug: string; name: string }[];
}) {
  const open = useUI((s) => s.menuOpen);
  const closeMenu = useUI((s) => s.closeMenu);
  const openSearch = useUI((s) => s.openSearch);
  const wishCount = useWishlist((s) => s.ids.length);
  const pathname = usePathname();
  const reduce = useReducedMotion();

  // Close on route change.
  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  // Lock body scroll and close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeMenu();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, closeMenu]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <button
            type="button"
            aria-label="Close menu"
            onClick={closeMenu}
            className="absolute inset-0 bg-ink-deep/80"
            tabIndex={-1}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={reduce ? { opacity: 0 } : { x: "-100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "-100%" }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong absolute inset-y-0 left-0 flex w-[min(21rem,88vw)] flex-col border-y-0 border-l-0"
          >
            <div className="flex items-center justify-between px-6 py-5">
              <Logo size="sm" />
              <button
                type="button"
                onClick={closeMenu}
                aria-label="Close menu"
                className="-mr-2 p-2 text-stone transition-colors hover:text-bone"
              >
                <X className="h-5 w-5" strokeWidth={1.4} />
              </button>
            </div>

            <div className="rule" />

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-7">
              <button
                type="button"
                onClick={openSearch}
                className="mb-8 flex w-full items-center gap-3 border border-line bg-surface-sunken px-4 py-3.5
                           font-sans text-sm text-stone-dark transition-colors hover:border-line-strong"
              >
                <Search className="h-4 w-4 text-gold/70" strokeWidth={1.4} />
                Search fragrances
              </button>

              <nav aria-label="Mobile">
                <ul className="space-y-1">
                  {NAV_LINKS.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="block py-3 font-display text-3xl font-light text-bone transition-colors hover:text-gold-light"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              {fragrances.length > 0 && (
                <>
                  <div className="my-7 flex items-center gap-3">
                    <span className="h-px flex-1 bg-line" />
                    <Sparkle className="h-2 w-2 text-gold" />
                    <span className="h-px flex-1 bg-line" />
                  </div>
                  <p className="micro-label mb-4">The five</p>
                  <ul className="space-y-2.5">
                    {fragrances.map((f) => (
                      <li key={f.slug}>
                        <Link
                          href={`/fragrance/${f.slug}`}
                          className="font-sans text-sm text-stone transition-colors hover:text-gold-light"
                        >
                          {f.name.replace(/^Avenues\s+/, "")}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="rule" />

            <div className="space-y-1 px-6 py-5">
              <MenuUtil href={isAuthed ? "/account" : "/login"} icon={<User className="h-4 w-4" strokeWidth={1.4} />}>
                {isAuthed ? "Your account" : "Sign in"}
              </MenuUtil>
              <MenuUtil href="/wishlist" icon={<Heart className="h-4 w-4" strokeWidth={1.4} />}>
                Wishlist{wishCount > 0 ? ` (${wishCount})` : ""}
              </MenuUtil>
              {whatsappHref && (
                <MenuUtil href={whatsappHref} external icon={<MessageCircle className="h-4 w-4" strokeWidth={1.4} />}>
                  WhatsApp us
                </MenuUtil>
              )}
              <MenuUtil href={`mailto:${supportEmail}`} external icon={<Mail className="h-4 w-4" strokeWidth={1.4} />}>
                {supportEmail}
              </MenuUtil>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MenuUtil({
  href,
  icon,
  children,
  external,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  external?: boolean;
}) {
  const cls =
    "flex items-center gap-3 py-2.5 font-sans text-sm text-stone transition-colors hover:text-gold-light";
  const inner = (
    <>
      <span className="text-gold/70">{icon}</span>
      {children}
    </>
  );

  if (external) {
    return (
      <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}
