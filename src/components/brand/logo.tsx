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
  /**
   * Both `mark` and `wordImg` are HEIGHTS with `w-auto`. The width follows from
   * each asset's own ratio, so the lockup keeps the proportions it was drawn
   * with and neither piece can be squashed by a box that disagrees with it.
   *
   * The mark used to be given a square box (`h-9 w-9`). The ring is 1.23:1, so
   * `object-contain` fitted it to the box's WIDTH and it drew at 36x29 inside a
   * 36x36 slot — a fifth of the height thrown away, which is most of why it
   * looked small and timid in the nav.
   *
   * The numbers then went up again, twice. Once because the mark still read as
   * a token rather than a masthead against a 72px nav bar, and once because the
   * assets now carry an 8% transparent margin of their own — so a 44px box only
   * ever draws about 37px of actual ink, and the box has to be bigger than the
   * mark you want to see.
   */
  const dims = {
    sm: { mark: "h-10 w-auto", wordImg: "h-[1.05rem] w-auto", sub: "text-[0.5rem] tracking-[0.34em]" },
    md: { mark: "h-14 w-auto", wordImg: "h-[1.45rem] w-auto", sub: "text-[0.6875rem] tracking-[0.36em]" },
    lg: { mark: "h-20 w-auto", wordImg: "h-[2.1rem] w-auto", sub: "text-[0.8125rem] tracking-[0.38em]" },
    xl: { mark: "h-32 w-auto", wordImg: "h-[3.4rem] w-auto", sub: "text-[0.875rem] tracking-[0.4em]" },
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

        These dimensions come from scripts/gen-logo.mjs and must track it. The
        first cut declared 440x415 against artwork whose ring measures 479x382,
        which stretched it 19% vertically and pushed the open ends of the arc
        off the bottom edge — the logo rendered visibly broken.

        Largest use is 128px (xl) against a 519px asset, so it is oversampled
        everywhere it appears, including at devicePixelRatio 3. The supplied
        logo is a 788px JPEG, and that is the ceiling — a genuinely
        resolution-independent mark needs the vector original.
      */}
      <Image
        src="/logo-mark.png"
        alt=""
        width={519}
        height={422}
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
            width={670}
            height={147}
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
