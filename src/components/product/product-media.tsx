import Image from "next/image";
import { BottleFigure } from "@/components/brand/bottle-figure";
import { cn } from "@/lib/utils";

/**
 * Product imagery with a graceful fallback.
 *
 * Until the founder uploads real photography from the admin panel, this
 * renders the engraved-bottle figure tinted for that fragrance. There is no
 * grey box and no stock photo anywhere in this site — the placeholder is a
 * designed object, so a catalogue with no photos still looks intentional.
 */
export function ProductMedia({
  slug,
  name,
  image,
  className,
  sizes = "(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw",
  priority = false,
  fill = true,
}: {
  slug: string;
  name: string;
  image: { url: string; alt: string } | null;
  className?: string;
  sizes?: string;
  priority?: boolean;
  fill?: boolean;
}) {
  if (!image) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center p-6", className)}>
        <BottleFigure slug={slug} alt={`${name} — bottle illustration`} className="max-h-full" />
      </div>
    );
  }

  return (
    <Image
      src={image.url}
      alt={image.alt || name}
      fill={fill}
      sizes={sizes}
      priority={priority}
      className={cn("object-cover", className)}
    />
  );
}
