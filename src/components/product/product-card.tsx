"use client";

import Link from "next/link";
import { ProductMedia } from "./product-media";
import { WishlistButton } from "./wishlist-button";
import { AddToCartButton } from "./add-to-cart-button";
import { Stars } from "./stars";
import { RingDraw } from "@/components/brand/gold-arc";
import { discountPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductCard as ProductCardData } from "@/lib/catalog";
import { Price, DiscountChip } from "@/components/product/price";

const GENDER_LABEL: Record<string, string> = {
  MEN: "For him",
  WOMEN: "For her",
  UNISEX: "Unisex",
};

export function ProductCard({
  product,
  index,
  priority = false,
  showNotes = false,
  className,
}: {
  product: ProductCardData;
  /** Renders the 01–05 index number used on the landing page and shop grid. */
  index?: number;
  priority?: boolean;
  /** Adds the base-note summary line — used on the landing collection grid. */
  showNotes?: boolean;
  className?: string;
}) {
  const v = product.defaultVariant;
  const off = v ? discountPercent(v.mrpPaise, v.pricePaise) : 0;

  // A card can only show one price, so on a multi-size product it shows the
  // cheapest buyable one — and has to say so. Without this the grid quietly
  // implied a 50ml-only range while a 100ml sat on the product page unseen.
  // Past three, spelling them all out overruns the plate's one label line, so
  // it states the count instead and lets the product page do the listing.
  const multiSize = product.variantCount > 1;
  const sizeLabel = !multiSize
    ? (v?.size ?? null)
    : product.variantCount > 3
      ? `${product.variantCount} sizes`
      : product.variants.map((x) => x.size).join(" / ");

  return (
    <article className={cn("group relative flex flex-col", className)}>
      <Link
        // Canonical route, so a combo card links to /set/… not /fragrance/….
        href={product.href}
        className="flex flex-1 flex-col focus-visible:outline-none"
        aria-label={`${product.name} — ${product.tagline}`}
      >
        {/* Lit vitrine */}
        <div className="vitrine relative aspect-[4/5] w-full">
          <div className="absolute inset-0 transition-transform duration-900 ease-smoke group-hover:scale-[1.03]">
            <ProductMedia
              slug={product.slug}
              name={product.name}
              image={product.image}
              hoverImage={product.hoverImage}
              priority={priority}
            />
          </div>

          {/* The signature: a ring drawing itself around the bottle on hover */}
          <RingDraw />

          {index !== undefined && (
            <span className="absolute left-4 top-4 font-sans text-micro text-stone-dark">
              {String(index).padStart(2, "0")}
            </span>
          )}

          {product.inStock && (
            <DiscountChip percent={off} className="absolute right-4 top-4" />
          )}

          {!product.inStock && (
            <span className="absolute inset-x-0 bottom-0 bg-ink-deep/90 py-2.5 text-center font-sans text-micro uppercase text-stone">
              Sold out
            </span>
          )}
        </div>

        {/* Plate */}
        <div className="flex flex-1 flex-col pt-5">
          <p className="micro-label">
            {GENDER_LABEL[product.gender] ?? product.gender}
            {sizeLabel && <> &middot; {sizeLabel}</>}
          </p>

          <h3 className="mt-2.5 font-display text-2xl font-light leading-tight text-bone transition-colors duration-400 ease-smoke group-hover:text-gold-light">
            {product.shortName}
          </h3>

          <p className="mt-1.5 font-sans text-sm leading-relaxed text-stone">{product.tagline}</p>

          {showNotes && product.notes.base.length > 0 && (
            <p className="mt-2.5 font-sans text-[0.625rem] uppercase tracking-label text-stone-dark">
              {product.notes.base.join(" · ")}
            </p>
          )}

          {product.reviewCount > 0 && (
            <Stars rating={product.avgRating} count={product.reviewCount} className="mt-3" />
          )}

          {/* Money: shared <Price>, so the card, the buy box and the cart all
              agree on face, weight and strikethrough. The card carries its own
              "% off" chip on the image, so the inline one is suppressed. */}
          {v && (
            <Price
              pricePaise={v.pricePaise}
              mrpPaise={v.mrpPaise}
              badge={false}
              size="md"
              className="mt-4"
              prefix={
                multiSize ? (
                  <span className="font-sans text-[0.625rem] uppercase tracking-label text-stone-dark">
                    From
                  </span>
                ) : null
              }
            />
          )}
        </div>
      </Link>

      {/* Quick actions. Always visible on touch, revealed on hover on desktop. */}
      <div className="mt-4 flex items-center gap-2">
        {multiSize && product.inStock ? (
          // Adding straight from the grid would silently pick the cheapest
          // size, which is the wrong bottle for anyone who came for the large
          // one. Send them to the page where the sizes are.
          <Link href={product.href} className="btn btn-outline btn-sm flex-1">
            Choose size
          </Link>
        ) : (
          <AddToCartButton
            className="btn-outline btn-sm flex-1"
            line={
              v
                ? {
                    variantId: v.id,
                    productId: product.id,
                    slug: product.slug,
                    name: product.name,
                    size: v.size,
                    sku: v.sku,
                    pricePaise: v.pricePaise,
                    mrpPaise: v.mrpPaise,
                    imageUrl: product.image?.url ?? null,
                    type: product.type,
                    maxStock: v.stock,
                  }
                : null
            }
          >
            {product.inStock ? "Add to cart" : "Sold out"}
          </AddToCartButton>
        )}

        <WishlistButton
          productId={product.id}
          productName={product.shortName}
          size="sm"
          className="h-10 w-10 shrink-0"
        />
      </div>
    </article>
  );
}
