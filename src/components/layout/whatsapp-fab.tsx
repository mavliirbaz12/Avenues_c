"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useUI } from "@/store/ui";

/**
 * Floating WhatsApp channel.
 *
 * Deliberately not the stock green blob — it is a dark glass disc with a gold
 * hairline, so it reads as part of the site rather than a bolted-on widget.
 * Appears after a short scroll so it never competes with the hero.
 *
 * Renders nothing at all when no WhatsApp number is configured in Admin →
 * Settings, rather than linking somewhere broken.
 */
export function WhatsAppFab({ href }: { href: string | null }) {
  const [visible, setVisible] = useState(false);
  const anyOverlayOpen = useUI((s) => s.cartOpen || s.searchOpen || s.menuOpen);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 380);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!href) return null;

  const show = visible && !anyOverlayOpen;

  return (
    <AnimatePresence>
      {show && (
        <motion.a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with Avenues on WhatsApp"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          // Sits above the mobile sticky add-to-cart bar, which sets
          // --sticky-bar-h on product pages.
          className="glass group fixed right-4 z-40 inline-flex h-13 w-13 items-center justify-center
                     rounded-pill border-gold/25 text-gold transition-colors duration-400 ease-smoke
                     hover:border-gold/60 hover:text-gold-light sm:right-6
                     h-[3.25rem] w-[3.25rem]"
          style={{ bottom: "calc(1rem + var(--sticky-bar-h, 0px))" }}
        >
          {/* Drawn rather than imported so the glyph matches the site's
              1.4 stroke weight instead of WhatsApp's brand shape. */}
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
          <span
            className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-sm
                       border border-line bg-surface-raised px-3 py-2 font-sans text-micro uppercase
                       text-bone opacity-0 transition-opacity duration-300 ease-smoke
                       group-hover:opacity-100 max-sm:hidden"
          >
            Chat with us
          </span>
        </motion.a>
      )}
    </AnimatePresence>
  );
}
