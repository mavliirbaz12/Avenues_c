"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The Avenues monogram — an open calligraphic arc around a high-contrast
 * serif "A" with a swash.
 *
 * Drawn from the brand logo rather than set in a webfont, so it renders
 * identically in the favicon, in transactional email, and before fonts load.
 *
 * Three details carry the character:
 *  - The ring is OPEN at the top and tapers to fine points. It is built from
 *    two arcs of different radii (43 out, 39 back) meeting at endpoints on a
 *    41 radius, which pinches the ends and swells the bottom the way a broad
 *    nib would.
 *  - The "A" has real stroke contrast: the left diagonal is thin, the right
 *    is half again as thick.
 *  - The swash crossbar overshoots the right leg and tapers to a point.
 */
export function Monogram({
  className,
  title,
  gradient = true,
}: {
  className?: string;
  /** Supply to expose the mark to assistive tech; omit for decorative use. */
  title?: string;
  /** Metallic gold gradient. Set false to inherit a flat `currentColor`. */
  gradient?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const fill = gradient ? `url(#av-gold-${uid})` : "currentColor";

  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("h-10 w-10", className)}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {gradient && (
        <defs>
          <linearGradient id={`av-gold-${uid}`} x1="18%" y1="0%" x2="82%" y2="100%">
            <stop offset="0%" stopColor="#F0DBA4" />
            <stop offset="34%" stopColor="#C9A24B" />
            <stop offset="68%" stopColor="#A67C2E" />
            <stop offset="100%" stopColor="#E0BE72" />
          </linearGradient>
        </defs>
      )}

      {/* Open tapered ring. Gap sits at the top, centred. */}
      <path
        d="M69.4 14.2 A43 43 0 1 1 30.6 14.2 A39 39 0 1 0 69.4 14.2 Z"
        fill={fill}
      />

      {/* The A. One path — the counter is carved by the winding, no mask needed. */}
      <path d="M50 20 L74.5 76 L63.5 76 L50 44 L37.5 76 L30.5 76 Z" fill={fill} />

      {/* Swash crossbar. It must overshoot the right leg and taper to a point —
          that overshoot is what makes it read as a flourish rather than a bar. */}
      <path
        d="M27 71.5 C36 60 56 55 71 56.8 C81 58 89 62.5 94 69.5
           C88.5 63.5 80.5 59.8 71 58.7 C56.5 57 39.5 61.8 27 71.5 Z"
        fill={fill}
      />
    </svg>
  );
}
