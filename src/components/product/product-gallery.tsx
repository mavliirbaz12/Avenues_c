"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { BottleFigure } from "@/components/brand/bottle-figure";
import { cn } from "@/lib/utils";

/**
 * Product gallery.
 *
 * TWO LAYOUTS, BECAUSE THE INPUT DEVICE IS DIFFERENT
 *
 * On a pointer device, a large image with a thumbnail rail is right: clicking a
 * specific shot is one movement, and hovering costs nothing.
 *
 * On a phone it is wrong. Thumbnails at 80px are a small target under a thumb,
 * and tapping one to change a picture is a worse gesture than the one every
 * phone user already has — swiping the picture itself. So mobile gets the
 * images as a horizontal scroller with CSS scroll-snap, driven by the browser's
 * own inertia rather than JavaScript.
 *
 * NO ARROWS, DELIBERATELY
 *
 * Arrows on a touch carousel are a desktop habit imported by mistake. They add
 * two tap targets that overlap the product, they need a hit area big enough to
 * be usable which means covering more of it, and they duplicate a gesture the
 * user already knows. The dots stay, because they answer a question swiping
 * cannot: how many images are there, and where am I. They are indicators, not
 * controls.
 *
 * With no uploaded photographs it shows a single engraved bottle figure and no
 * rail at all — a carousel with one slide and a row of identical thumbnails is
 * worse than no carousel.
 */
export function ProductGallery({
  slug,
  name,
  images,
}: {
  slug: string;
  name: string;
  images: { url: string; alt: string }[];
}) {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  if (images.length === 0) {
    return (
      <div className="vitrine relative aspect-[4/5] w-full">
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <BottleFigure slug={slug} alt={`${name} — bottle illustration`} />
        </div>
      </div>
    );
  }

  const current = images[Math.min(active, images.length - 1)]!;

  /**
   * Which slide is showing, derived from scroll position rather than tracked.
   *
   * Rounding scrollLeft against the track width means the dots stay right when
   * a swipe is flicked past several images, or interrupted halfway and let go —
   * cases a "next/previous" counter gets wrong.
   */
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setVisible(Math.max(0, Math.min(images.length - 1, i)));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Phone: swipe ------------------------------------------------ */}
      <div className="lg:hidden">
        <div
          ref={trackRef}
          onScroll={onScroll}
          // `-mx-gutter` lets the images bleed to both edges, so the next one
          // peeking past the screen edge is what signals it can be swiped —
          // the affordance the arrows were there to provide.
          className="no-scrollbar -mx-gutter flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
          style={{ scrollbarWidth: "none" }}
        >
          {images.map((img, i) => (
            <div key={img.url + i} className="w-full shrink-0 snap-center px-gutter">
              <div className="vitrine relative aspect-[4/5] w-full">
                <Image
                  src={img.url}
                  alt={img.alt || `${name} — image ${i + 1} of ${images.length}`}
                  fill
                  // Only the first is worth blocking render on; the rest are
                  // one swipe away and should not compete for the connection.
                  priority={i === 0}
                  sizes="100vw"
                  className="object-cover"
                />
              </div>
            </div>
          ))}
        </div>

        {images.length > 1 && (
          <div
            className="mt-4 flex items-center justify-center gap-2"
            role="status"
            aria-live="polite"
            aria-label={`Image ${visible + 1} of ${images.length}`}
          >
            {images.map((img, i) => (
              <span
                key={img.url + i}
                aria-hidden="true"
                className={cn(
                  "h-1 rounded-full transition-all duration-400 ease-smoke",
                  i === visible ? "w-6 bg-gold" : "w-1.5 bg-line-strong",
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---- Pointer: large image + thumbnail rail ------------------------ */}
      <div className="hidden lg:flex lg:flex-col lg:gap-4">
        <div className="vitrine relative aspect-[4/5] w-full">
          <Image
            src={current.url}
            alt={current.alt || name}
            fill
            priority
            sizes="46vw"
            className="object-cover"
          />
        </div>

        {images.length > 1 && (
          <div
            className="no-scrollbar flex gap-3 overflow-x-auto"
            role="tablist"
            aria-label={`${name} images`}
          >
            {images.map((img, i) => (
              <button
                key={img.url + i}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`View image ${i + 1} of ${images.length}`}
                onClick={() => setActive(i)}
                className={cn(
                  "relative aspect-square w-20 shrink-0 overflow-hidden border transition-colors duration-400 ease-smoke",
                  i === active ? "border-gold/60" : "border-line hover:border-line-strong",
                )}
              >
                <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
