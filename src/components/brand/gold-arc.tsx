"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Sparkle } from "./sparkle";
import { cn } from "@/lib/utils";

/**
 * Section divider derived from the logo's ring: a very shallow gold arc that
 * fades out at both ends, punctuated by the brand's four-pointed star.
 *
 * The arc draws itself in when it scrolls into view. This is the site's
 * connective tissue — it appears between every major band of content.
 */
export function GoldArc({
  className,
  label,
  flip = false,
}: {
  className?: string;
  /** Optional letter-spaced micro-label rendered under the star. */
  label?: string;
  /** Curve downward instead of upward. */
  flip?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const reduce = useReducedMotion();

  return (
    <div className={cn("relative w-full select-none", className)} aria-hidden={!label}>
      <svg
        viewBox="0 0 1200 44"
        preserveAspectRatio="none"
        className="h-8 w-full sm:h-11"
        fill="none"
      >
        <defs>
          <linearGradient id={`arc-${uid}`} x1="0%" x2="100%">
            <stop offset="0%" stopColor="#C9A24B" stopOpacity="0" />
            <stop offset="28%" stopColor="#C9A24B" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#E8CE8C" stopOpacity="0.9" />
            <stop offset="72%" stopColor="#C9A24B" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#C9A24B" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d={flip ? "M0 6 Q600 42 1200 6" : "M0 38 Q600 2 1200 38"}
          stroke={`url(#arc-${uid})`}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          initial={reduce ? undefined : { pathLength: 0, opacity: 0 }}
          whileInView={reduce ? undefined : { pathLength: 1, opacity: 1 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 flex flex-col items-center gap-3",
          flip ? "bottom-0" : "top-0",
        )}
      >
        <Sparkle className="h-2.5 w-2.5 text-gold" />
        {label && <span className="micro-label-gold">{label}</span>}
      </div>
    </div>
  );
}

/**
 * The product-card hover state: a ring that draws itself around the bottle.
 * Sits absolutely inside a `group` and animates on group-hover via CSS, so it
 * costs nothing until the pointer arrives.
 */
export function RingDraw({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    >
      <circle
        cx="100"
        cy="100"
        r="72"
        stroke="#C9A24B"
        strokeWidth="0.6"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
        className="[stroke-dasharray:1] [stroke-dashoffset:1] opacity-0 transition-[stroke-dashoffset,opacity] duration-[1200ms] ease-smoke group-hover:opacity-70 group-hover:[stroke-dashoffset:0] group-focus-visible:opacity-70 group-focus-visible:[stroke-dashoffset:0]"
        transform="rotate(-90 100 100)"
      />
    </svg>
  );
}
