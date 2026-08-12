"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { hashCode } from "@/lib/utils";

/**
 * Placeholder product art: a black glass bottle, lit from behind.
 *
 * Shown wherever a product has no uploaded photograph yet. The moment the
 * founder uploads a real image from the admin panel, ProductMedia swaps this
 * out — so the storefront never renders a broken frame or a grey box, and
 * never needs a stock photo.
 *
 * The glow behind the bottle is tinted per fragrance, which gives the five
 * cards distinct silhouettes on the shop grid instead of five identical bottles.
 */

const TINTS: Record<string, string> = {
  intense: "#C9A24B",
  "pink-aura": "#C97B8E",
  "night-drip": "#B4623A",
  "blue-mist": "#5B8FA8",
  "white-oud": "#D2A85F",
};

const FALLBACK_TINTS = ["#C9A24B", "#C97B8E", "#B4623A", "#5B8FA8", "#D2A85F"];

export function tintForSlug(slug: string) {
  return TINTS[slug] ?? FALLBACK_TINTS[hashCode(slug) % FALLBACK_TINTS.length];
}

export function BottleFigure({
  slug = "intense",
  className,
  alt,
}: {
  slug?: string;
  className?: string;
  /** Provide when this stands in for a product image. */
  alt?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const tint = tintForSlug(slug);

  return (
    <svg
      viewBox="0 0 240 360"
      className={cn("h-full w-full", className)}
      role={alt ? "img" : "presentation"}
      aria-label={alt}
      aria-hidden={alt ? undefined : true}
    >
      <defs>
        {/* Candlelit halo behind the glass. */}
        <radialGradient id={`halo-${uid}`} cx="50%" cy="56%" r="46%">
          <stop offset="0%" stopColor={tint} stopOpacity="0.34" />
          <stop offset="55%" stopColor={tint} stopOpacity="0.09" />
          <stop offset="100%" stopColor={tint} stopOpacity="0" />
        </radialGradient>

        {/* Black glass: never pure black, so the form stays readable. */}
        <linearGradient id={`glass-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#26262B" />
          <stop offset="34%" stopColor="#141417" />
          <stop offset="72%" stopColor="#0C0C0E" />
          <stop offset="100%" stopColor="#1A1A1F" />
        </linearGradient>

        <linearGradient id={`cap-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1F1F24" />
          <stop offset="22%" stopColor="#3A3A42" />
          <stop offset="46%" stopColor="#131316" />
          <stop offset="78%" stopColor="#2A2A31" />
          <stop offset="100%" stopColor="#0E0E10" />
        </linearGradient>

        {/* Specular strip down the left shoulder. */}
        <linearGradient id={`spec-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F2EDE3" stopOpacity="0" />
          <stop offset="45%" stopColor="#F2EDE3" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#F2EDE3" stopOpacity="0" />
        </linearGradient>

        <linearGradient id={`rim-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={tint} stopOpacity="0" />
          <stop offset="40%" stopColor={tint} stopOpacity="0.5" />
          <stop offset="100%" stopColor={tint} stopOpacity="0.12" />
        </linearGradient>

        <linearGradient id={`gold-${uid}`} x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#F0DBA4" />
          <stop offset="45%" stopColor="#C9A24B" />
          <stop offset="100%" stopColor="#8A6B2A" />
        </linearGradient>
      </defs>

      <ellipse cx="120" cy="196" rx="112" ry="140" fill={`url(#halo-${uid})`} />

      {/* Cap */}
      <rect x="94" y="30" width="52" height="62" rx="3" fill={`url(#cap-${uid})`} />
      <rect x="94" y="30" width="52" height="62" rx="3" fill="none" stroke="#3A3A42" strokeWidth="0.6" />
      {/* Collar */}
      <rect x="102" y="92" width="36" height="14" rx="1.5" fill="#0E0E10" stroke="#2E2E35" strokeWidth="0.5" />

      {/* Shoulders + body */}
      <path
        d="M64 138 C64 118 82 106 120 106 C158 106 176 118 176 138 L176 316 C176 325 170 330 161 330 L79 330 C70 330 64 325 64 316 Z"
        fill={`url(#glass-${uid})`}
        stroke="#33333A"
        strokeWidth="0.8"
      />

      {/* Left rim light, right rim light */}
      <path
        d="M64 140 C64 120 82 108 118 107"
        stroke={`url(#rim-${uid})`}
        strokeWidth="1.6"
        fill="none"
      />
      <path d="M66 150 L66 314" stroke={`url(#rim-${uid})`} strokeWidth="1.4" fill="none" />
      <path d="M174 150 L174 314" stroke={`url(#rim-${uid})`} strokeWidth="1" fill="none" opacity="0.55" />

      {/* Specular highlight down the glass */}
      <rect x="80" y="132" width="16" height="176" rx="8" fill={`url(#spec-${uid})`} />

      {/* Engraved monogram, foiled onto the glass */}
      <g transform="translate(120 214) scale(0.66) translate(-50 -50)" opacity="0.92">
        <path d="M69.4 14.2 A43 43 0 1 1 30.6 14.2 A39 39 0 1 0 69.4 14.2 Z" fill={`url(#gold-${uid})`} />
        <path d="M50 20 L74.5 76 L63.5 76 L50 44 L37.5 76 L30.5 76 Z" fill={`url(#gold-${uid})`} />
        <path
          d="M27 71.5 C36 60 56 55 71 56.8 C81 58 89 62.5 94 69.5 C88.5 63.5 80.5 59.8 71 58.7 C56.5 57 39.5 61.8 27 71.5 Z"
          fill={`url(#gold-${uid})`}
        />
      </g>

      {/* Base shadow, grounding the bottle */}
      <ellipse cx="120" cy="333" rx="62" ry="7" fill="#000" opacity="0.55" />
    </svg>
  );
}
