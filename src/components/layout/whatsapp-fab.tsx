"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useUI } from "@/store/ui";

/**
 * The floating query channel — a dark glass disc with a gold hairline,
 * deliberately not the stock green blob, so it reads as part of the site
 * rather than a bolted-on widget. Appears after a short scroll so it never
 * competes with the hero.
 *
 * Two modes:
 *  - WhatsApp number configured in Admin → Settings ⇒ opens wa.me with a
 *    pre-filled greeting.
 *  - No number yet ⇒ falls back to the contact form, so the query icon is
 *    never simply absent while the founder is still setting up.
 */
export function WhatsAppFab({ href }: { href: string | null }) {
  const [visible, setVisible] = useState(false);
  const anyOverlayOpen = useUI((s) => s.cartOpen || s.searchOpen || s.menuOpen);
  const reduce = useReducedMotion();
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 380);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // On the contact page itself the fallback icon would just link to the page
  // you are already on.
  if (!href && pathname === "/contact") return null;

  const show = visible && !anyOverlayOpen;

  const disc =
    "glass group fixed right-4 z-40 inline-flex h-[3.25rem] w-[3.25rem] items-center justify-center " +
    "rounded-pill border-gold/25 text-gold transition-colors duration-400 ease-smoke " +
    "hover:border-gold/60 hover:text-gold-light sm:right-6";

  const motionProps = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 16 },
    animate: reduce ? { opacity: 1 } : { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: 16 },
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
    // Sits above the mobile sticky add-to-cart bar, which sets
    // --sticky-bar-h on product pages.
    style: { bottom: "calc(1rem + var(--sticky-bar-h, 0px))" },
    className: disc,
  };

  return (
    <AnimatePresence>
      {show &&
        (href ? (
          <motion.a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat with Avenues on WhatsApp"
            {...motionProps}
          >
            <WhatsAppGlyph />
            <Tooltip>Chat with us</Tooltip>
          </motion.a>
        ) : (
          <motion.span {...motionProps}>
            <Link
              href="/contact"
              aria-label="Questions? Write to us"
              className="inline-flex h-full w-full items-center justify-center"
            >
              <ChatGlyph />
              <Tooltip>Questions? Write to us</Tooltip>
            </Link>
          </motion.span>
        ))}
    </AnimatePresence>
  );
}

/** Drawn to match the site's 1.4 stroke weight, not WhatsApp's brand shape. */
function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M3.6 20.4l1.2-4.1a7.8 7.8 0 1 1 3 2.9l-4.2 1.2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M9.1 8.4c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .6.5l.6 1.4c.1.2 0 .4-.1.5l-.4.5c-.1.2-.2.3 0 .6a6 6 0 0 0 2.6 2.2c.3.1.4 0 .6-.1l.5-.6c.2-.2.3-.2.5-.1l1.4.7c.2.1.4.2.4.4v.5c0 .5-.5 1.1-1 1.2-.5.1-1.1.2-3.3-.8a8.2 8.2 0 0 1-3.5-3.4c-.7-1.3-.7-2.1-.6-2.6a1.6 1.6 0 0 1 .5-.8z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Speech bubble with the brand's four-pointed star inside. */
function ChatGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H9l-4.2 3.4c-.4.3-.8 0-.8-.4V6.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M12 7.2c.3 2.1 1.2 3 3.3 3.3-2.1.3-3 1.2-3.3 3.3-.3-2.1-1.2-3-3.3-3.3 2.1-.3 3-1.2 3.3-3.3z"
        fill="currentColor"
      />
    </svg>
  );
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-sm
                 border border-line bg-surface-raised px-3 py-2 font-sans text-micro uppercase
                 text-bone opacity-0 transition-opacity duration-300 ease-smoke
                 group-hover:opacity-100 max-sm:hidden"
    >
      {children}
    </span>
  );
}
