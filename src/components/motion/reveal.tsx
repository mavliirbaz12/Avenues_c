"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * The site's two motion primitives.
 *
 * House rule: everything eases on [0.22, 1, 0.36, 1] and travels a short
 * distance over a long duration — slow smoke, not a toy. Nothing scales,
 * nothing bounces, nothing rotates.
 *
 * `useReducedMotion` is checked in both, and globals.css additionally clamps
 * every animation to ~0ms under the media query, so this is belt and braces.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

/** Scroll-triggered fade + rise. Fires once. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  duration = 0.9,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  duration?: number;
}) {
  const reduce = useReducedMotion();

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px -8% 0px" }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Staggers direct children of a container as it enters the viewport. */
export function RevealGroup({
  children,
  className,
  stagger = 0.09,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}) {
  const reduce = useReducedMotion();

  if (reduce) return <div className={className}>{children}</div>;

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren: delay } },
  };

  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-12% 0px -8% 0px" }}
    >
      {children}
    </motion.div>
  );
}

/** A child of RevealGroup. */
export function RevealItem({
  children,
  className,
  y = 24,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  const reduce = useReducedMotion();

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Headline reveal: each line sits in an overflow mask and slides up out of it.
 * Pass lines already split — splitting here would break on responsive rewraps.
 *
 * Runs on mount rather than on scroll, because this is only ever used above
 * the fold.
 */
export function RevealLines({
  lines,
  className,
  lineClassName,
  delay = 0.15,
  stagger = 0.11,
}: {
  lines: ReactNode[];
  className?: string;
  lineClassName?: string;
  delay?: number;
  stagger?: number;
}) {
  const reduce = useReducedMotion();

  return (
    <span className={className}>
      {lines.map((line, i) => (
        <span key={i} className={cn("line-mask", lineClassName)}>
          {reduce ? (
            <span className="block">{line}</span>
          ) : (
            <motion.span
              className="block"
              initial={{ y: "110%" }}
              animate={{ y: "0%" }}
              transition={{ duration: 1.1, delay: delay + i * stagger, ease: EASE }}
            >
              {line}
            </motion.span>
          )}
        </span>
      ))}
    </span>
  );
}
