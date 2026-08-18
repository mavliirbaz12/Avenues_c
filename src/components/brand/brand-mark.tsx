import Image from "next/image";
import logoMark from "@/assets/logo-mark.png";
import { cn } from "@/lib/utils";

/**
 * The Avenues monogram — the supplied artwork, not a redraw.
 *
 * This replaces the hand-drawn `Monogram` SVG everywhere it was used. The two
 * were visibly different marks: the real one has a wider circle gap and a
 * longer swash on the A, and having both in the same page (the nav showing one,
 * the hero watermark the other) read as a mistake because it was one.
 *
 * `opacity` rather than colour: the artwork carries its own gold gradient, so
 * unlike the SVG it cannot be tinted with `currentColor`. Every previous use
 * was either full-strength or a faint watermark, which opacity covers.
 */
export function BrandMark({
  className,
  opacity,
  priority = false,
  alt = "",
}: {
  className?: string;
  /** 0-1. Used for the large background watermarks. */
  opacity?: number;
  priority?: boolean;
  alt?: string;
}) {
  return (
    <Image
      src={logoMark}
      alt={alt}
      priority={priority}
      aria-hidden={alt ? undefined : true}
      className={cn("object-contain", className)}
      style={opacity === undefined ? undefined : { opacity }}
    />
  );
}
