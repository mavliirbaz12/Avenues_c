import Link from "next/link";
import Image from "next/image";
import logoMark from "@/assets/logo-mark.png";
import logoWordmark from "@/assets/logo-wordmark.png";
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
   * The numbers then went up, twice. Once because the mark still read as a
   * token rather than a masthead against a 72px nav bar, and once because the
   * assets carry an 8% transparent margin of their own — so the box always has
   * to be a little bigger than the mark you want to see.
   *
   * The wordmark is sized to read as the BRAND NAME, not as a caption hanging
   * off the mark. It had been set from a box that was 63% empty space, so the
   * letters rendered around eight pixels tall next to a 56px monogram. Both
   * assets are now ~86% ink, so these heights mean roughly what they say.
   */
  const dims = {
    sm: { wordWrap: "flex", mark: "h-9 w-auto", wordImg: "h-[1.1rem] w-auto", sub: "text-[0.5rem] tracking-[0.34em]" },
    /*
     * `md` is the nav, and the nav is the only place the lockup competes for
     * width. These steps are set by measurement, not taste.
     *
     * Two numbers drive all of this and neither is negotiable: the wordmark
     * asset is 586x63, so it is 9.3x as wide as it is tall, and the mark is
     * 503x406, so 1.24x. A legible lockup — an 11px wordmark beside a 36px
     * mark — is therefore about 157px wide, and no font size makes that
     * narrower without making the name unreadable.
     *
     * The wordmark used to disappear below 400px, so a 360px phone got the
     * monogram alone and a 400px one got the whole brand. That was a
     * consequence of the lockup being ABSOLUTELY CENTRED in the bar: a centred
     * element loses TWICE whatever clearance it needs, because the constraint
     * is the distance to the NEARER edge, not the leftover space. Measured in
     * the browser at 360px, the icon cluster left 55px of half-width — 110px of
     * lockup against the 157px the name needs. There is no phone width at which
     * a centred lockup and a legible wordmark both fit.
     *
     * So the lockup is now an ordinary flex item on the phone bar, as it
     * already was from `lg` up (see site-nav.tsx). In flow it is bounded by the
     * space actually left rather than by double the nearer gap — 194px at
     * 360px on the same measurement — and the name fits at every width:
     *
     *   320px    mark 32px + wordmark 0.62rem   lockup ~138px  (avail ~154px)
     *   360px+   mark 36px + wordmark 0.70rem   lockup ~157px  (avail ~194px)
     *   440px+   mark 36px + wordmark 0.95rem   lockup ~194px  (avail ~258px)
     *   768px+   mark 56px + wordmark 1.65rem   lockup ~326px
     *
     * The full-size step is still held to `md`, not `sm`: at 640 the icon
     * cluster gains the search control while the bar is still narrow.
     */
    md: {
      mark: "h-8 w-auto min-[360px]:h-9 md:h-14",
      wordImg: "h-[0.62rem] w-auto min-[360px]:h-[0.7rem] min-[440px]:h-[0.95rem] md:h-[1.65rem]",
      // No width gate any more. The brand is the mark AND the name, on every
      // screen that renders this bar.
      wordWrap: "flex",
      sub: "text-[0.6875rem] tracking-[0.36em]",
    },
    lg: { wordWrap: "flex", mark: "h-20 w-auto", wordImg: "h-[2.3rem] w-auto", sub: "text-[0.8125rem] tracking-[0.38em]" },
    xl: { wordWrap: "flex", mark: "h-32 w-auto", wordImg: "h-[3.6rem] w-auto", sub: "text-[0.875rem] tracking-[0.4em]" },
  }[size] as { mark: string; wordImg: string; sub: string; wordWrap: string };

  const inner = (
    <span
      className={cn(
        "group inline-flex",
        // Tighter gap on the phone bar, where every pixel is contested.
        stacked ? "flex-col items-center gap-4" : "items-center gap-1.5 min-[360px]:gap-2 md:gap-3",
        className,
      )}
    >
      {/*
        The real mark, keyed off its black backing so it sits on glass, ink or
        the invoice's paper without a visible rectangle.

        Imported rather than referenced by URL, so next/image takes the
        intrinsic size from the file. That is not a detail: the first cut
        declared 440x415 by hand against artwork measuring 479x382, stretching
        it 19% and pushing the open ends of the arc off the bottom edge. Numbers
        that have to be kept in step with a file eventually are not.

        Largest use is 128px (xl) against a 503px asset, so it is oversampled
        everywhere it appears, including at devicePixelRatio 3. The supplied
        logo is a 788px JPEG, and that is the ceiling — a genuinely
        resolution-independent mark needs the vector original.
      */}
      <Image
        src={logoMark}
        alt=""
        priority
        className={cn(dims.mark, "shrink-0 object-contain")}
      />
      {showWordmark && (
        <span className={cn(dims.wordWrap, "flex-col", stacked ? "items-center gap-1.5" : "items-start gap-1")}>
          {/*
            The real wordmark, not type set to look like it.

            It was previously Cormorant in bone with hand-tuned tracking — a
            close imitation, but the supplied lockup has its own letterforms and
            its gold gradient, and next to the actual mark the difference showed.
          */}
          <Image
            src={logoWordmark}
            alt="Avenues"
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
