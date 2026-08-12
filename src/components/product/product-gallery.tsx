"use client";

import { useState } from "react";
import Image from "next/image";
import { BottleFigure } from "@/components/brand/bottle-figure";
import { cn } from "@/lib/utils";

/**
 * Product gallery.
 *
 * With no uploaded photographs it shows a single engraved bottle figure and
 * hides the thumbnail rail entirely — an image carousel with one slide and a
 * row of identical thumbnails is worse than no carousel. The rail appears on
 * its own as soon as an admin uploads a second image.
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

  return (
    <div className="flex flex-col gap-4">
      <div className="vitrine relative aspect-[4/5] w-full">
        <Image
          src={current.url}
          alt={current.alt || name}
          fill
          priority
          sizes="(max-width: 1024px) 92vw, 46vw"
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
  );
}
