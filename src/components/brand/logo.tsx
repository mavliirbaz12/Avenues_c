import Link from "next/link";
import { Monogram } from "./monogram";
import { cn } from "@/lib/utils";

/**
 * The lockup: monogram + serif wordmark.
 *
 * The wordmark is set in the display serif, not the UI sans — that is what the
 * engraved logo does, and using the sans here made it read like a tech startup.
 * All-caps is a type treatment reserved for this lockup and letter-spaced nav
 * labels; in body copy the brand is always written "Avenues".
 */
export function Logo({
  className,
  href = "/",
  showWordmark = true,
  showSubmark = false,
  size = "md",
  stacked = false,
}: {
  className?: string;
  href?: string | null;
  showWordmark?: boolean;
  /** Renders "PERFUMES" beneath, as on the bottle label. */
  showSubmark?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  /** Vertical lockup — used in the footer and on the auth pages. */
  stacked?: boolean;
}) {
  const dims = {
    sm: { mark: "h-7 w-7", word: "text-sm tracking-[0.34em]", sub: "text-[0.5rem] tracking-[0.34em]" },
    md: { mark: "h-9 w-9", word: "text-lg tracking-[0.36em]", sub: "text-[0.5625rem] tracking-[0.36em]" },
    lg: { mark: "h-14 w-14", word: "text-2xl tracking-[0.38em]", sub: "text-[0.6875rem] tracking-[0.38em]" },
    xl: { mark: "h-24 w-24", word: "text-4xl tracking-[0.4em]", sub: "text-xs tracking-[0.4em]" },
  }[size];

  const inner = (
    <span
      className={cn(
        "group inline-flex",
        stacked ? "flex-col items-center gap-4" : "items-center gap-3",
        className,
      )}
    >
      <Monogram className={cn(dims.mark, "shrink-0")} />
      {showWordmark && (
        <span className={cn("flex flex-col", stacked ? "items-center gap-1.5" : "items-start gap-1")}>
          <span
            className={cn(
              // The trailing letter-space adds a phantom gap after the final
              // "S"; the negative margin pulls the optical centre back.
              "font-display font-light uppercase leading-none text-bone -mr-[0.36em]",
              "transition-colors duration-600 ease-smoke group-hover:text-gold-light",
              dims.word,
            )}
          >
            Avenues
          </span>
          {showSubmark && (
            <span className={cn("font-sans uppercase leading-none text-gold/70 -mr-[0.38em]", dims.sub)}>
              Perfumes
            </span>
          )}
        </span>
      )}
    </span>
  );

  if (!href) return inner;

  return (
    <Link href={href} aria-label="Avenues — home" className="inline-flex">
      {inner}
    </Link>
  );
}
