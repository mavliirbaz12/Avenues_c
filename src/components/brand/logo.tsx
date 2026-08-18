import Link from "next/link";
import Image from "next/image";
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
    // `wordImg` is a height; the width follows from the asset's own ratio, so
    // the lockup keeps the proportions it was drawn with.
    sm: { mark: "h-7 w-7", wordImg: "h-[0.7rem] w-auto", sub: "text-[0.5rem] tracking-[0.34em]" },
    md: { mark: "h-9 w-9", wordImg: "h-[0.95rem] w-auto", sub: "text-[0.5625rem] tracking-[0.36em]" },
    lg: { mark: "h-14 w-14", wordImg: "h-[1.4rem] w-auto", sub: "text-[0.6875rem] tracking-[0.38em]" },
    xl: { mark: "h-24 w-24", wordImg: "h-[2.4rem] w-auto", sub: "text-xs tracking-[0.4em]" },
  }[size];

  const inner = (
    <span
      className={cn(
        "group inline-flex",
        stacked ? "flex-col items-center gap-4" : "items-center gap-3",
        className,
      )}
    >
      {/*
        The real mark, keyed off its black backing so it sits on glass, ink or
        the invoice's paper without a visible rectangle.

        Largest use is 96px (xl) against a 440px asset, so it is oversampled
        everywhere it appears, including at devicePixelRatio 3. The supplied
        logo is a 788px JPEG, and that is the ceiling — a genuinely
        resolution-independent mark needs the vector original.
      */}
      <Image
        src="/logo-mark.png"
        alt=""
        width={440}
        height={415}
        priority
        className={cn(dims.mark, "shrink-0 object-contain")}
      />
      {showWordmark && (
        <span className={cn("flex flex-col", stacked ? "items-center gap-1.5" : "items-start gap-1")}>
          {/*
            The real wordmark, not type set to look like it.

            It was previously Cormorant in bone with hand-tuned tracking — a
            close imitation, but the supplied lockup has its own letterforms and
            its gold gradient, and next to the actual mark the difference showed.
          */}
          <Image
            src="/logo-wordmark.png"
            alt="Avenues"
            width={680}
            height={92}
            priority
            className={cn(dims.wordImg, "object-contain")}
          />
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
