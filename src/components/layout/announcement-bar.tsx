"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Sparkle } from "@/components/brand/sparkle";

const DISMISS_KEY = "avenues-announcement-dismissed";
const BAR_HEIGHT = "2.25rem";

/**
 * The announcement strip above the nav.
 *
 * Deliberately static — no marquee, no rotating ticker. One short line the
 * founder edits in Admin → Settings.
 *
 * It owns `--announce-h` on the root element rather than pushing layout,
 * because the nav is `fixed` and the hero pulls itself up underneath it: main's
 * top padding and the hero's negative margin both read `--header-h`, so setting
 * one variable keeps all three in agreement. Dismissal is remembered per
 * browser and the variable resets to 0, so nothing is left floating.
 */
export function AnnouncementBar({
  text,
  href,
}: {
  text: string;
  href?: string | null;
}) {
  // Start hidden and reveal after checking storage — rendering the bar and
  // then yanking it away would shift the whole page on first paint.
  const [state, setState] = useState<"checking" | "shown" | "dismissed">("checking");

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === text;
    } catch {
      // Storage blocked — show it; an announcement is not worth failing over.
    }
    setState(dismissed ? "dismissed" : "shown");
  }, [text]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--announce-h", state === "shown" ? BAR_HEIGHT : "0rem");
    return () => root.style.setProperty("--announce-h", "0rem");
  }, [state]);

  if (state !== "shown") return null;

  const body = (
    <>
      <Sparkle className="h-2 w-2 shrink-0 text-gold/70" />
      <span className="truncate">{text}</span>
    </>
  );

  return (
    <div
      className="fixed inset-x-0 top-0 z-[55] flex items-center justify-center gap-3 border-b border-gold/15 bg-ink-deep px-10"
      style={{ height: BAR_HEIGHT }}
    >
      {href ? (
        <Link
          href={href}
          className="flex items-center gap-3 font-sans text-micro uppercase text-gold transition-colors hover:text-gold-light"
        >
          {body}
        </Link>
      ) : (
        <p className="flex items-center gap-3 font-sans text-micro uppercase text-gold">{body}</p>
      )}

      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, text);
          } catch {
            // Not fatal — it simply reappears next visit.
          }
          setState("dismissed");
        }}
        aria-label="Dismiss announcement"
        className="absolute right-3 p-1 text-gold/50 transition-colors hover:text-gold-light"
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.6} />
      </button>
    </div>
  );
}
