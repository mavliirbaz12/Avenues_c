import Image from "next/image";
import { BottleFigure } from "@/components/brand/bottle-figure";
import { cn } from "@/lib/utils";

/**
 * Product imagery with a graceful fallback and an optional hover crossfade.
 *
 * Until the founder uploads real photography from the admin panel, this
 * renders the engraved-bottle figure tinted for that fragrance. There is no
 * grey box and no stock photo anywhere in this site — the placeholder is a
 * designed object, so a catalogue with no photos still looks intentional.
 *
 * The hover layer only mounts when a SECOND image exists. Rendering it
 * unconditionally would crossfade the placeholder into itself, which reads as
 * a flicker bug rather than a reveal. Must sit inside a `group`.
 */
export function ProductMedia({
  slug,
  name,
  image,
  hoverImage,
  className,
  sizes = "(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw",
  priority = false,
}: {
  slug: string;
  name: string;
  image: { url: string; alt: string } | null;
  /** Second uploaded image — the lifestyle shot revealed on hover. */
  hoverImage?: { url: string; alt: string } | null;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (!image) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center p-6", className)}>
        <BottleFigure slug={slug} alt={`${name} — bottle illustration`} className="max-h-full" />
      </div>
    );
  }

  return (
    <>
      <Image
        src={image.url}
        alt={image.alt || name}
        fill
        sizes={sizes}
        priority={priority}
        className={cn(
          "object-cover",
          // Fade the primary out only when there is something behind it.
          hoverImage && "transition-opacity duration-700 ease-smoke group-hover:opacity-0",
          className,
        )}
      />

      {hoverImage && (
        <Image
          src={hoverImage.url}
          alt=""
          aria-hidden="true"
          fill
          sizes={sizes}
          className={cn(
            "object-cover opacity-0 transition-[opacity,transform] duration-700 ease-smoke",
            "scale-[1.02] group-hover:scale-100 group-hover:opacity-100",
            className,
          )}
        />
      )}
    </>
  );
}
