"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, Truck, ShieldCheck, Clock } from "lucide-react";
import { AddToCartButton } from "./add-to-cart-button";
import { WishlistButton } from "./wishlist-button";
import { Stars } from "./stars";
import { useVariantSelection } from "./variant-selection";
import { formatPaise, discountPercent } from "@/lib/format";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { Price } from "@/components/product/price";

export type BuyVariant = {
  id: string;
  size: string;
  sku: string;
  mrpPaise: number;
  pricePaise: number;
  stock: number;
};

const LOW_STOCK_AT = 10;

export function BuyBox({
  product,
  variants,
  imageUrl,
  whatsappNumber,
  codEnabled,
  freeShippingThresholdPaise,
}: {
  product: {
    id: string;
    slug: string;
    name: string;
    shortName: string;
    tagline: string;
    concentration: string;
    longevity: string;
    avgRating: number;
    reviewCount: number;
  };
  variants: BuyVariant[];
  imageUrl: string | null;
  whatsappNumber: string | null;
  codEnabled: boolean;
  freeShippingThresholdPaise: number;
}) {
  // The selected size lives in page context, not here: the statutory Product
  // information panel further down the page has to name the same size and MRP
  // the shopper is looking at.
  const { selectedId: variantId, select: setVariantId } = useVariantSelection();
  const [qty, setQty] = useState(1);

  // Drives the thumb-reachable sticky bar on mobile: it appears once the real
  // actions scroll out of view, and shares this component's variant state so
  // the two can never disagree about which size is selected.
  const actionsRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const el = actionsRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setShowSticky(!entry!.isIntersecting), {
      rootMargin: "-72px 0px 0px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const variant = variants.find((v) => v.id === variantId) ?? variants[0] ?? null;
  const off = variant ? discountPercent(variant.mrpPaise, variant.pricePaise) : 0;
  const soldOut = !variant || variant.stock <= 0;
  const low = variant ? variant.stock > 0 && variant.stock < LOW_STOCK_AT : false;
  const maxQty = variant ? Math.min(variant.stock, 10) : 1;

  const line = variant
    ? {
        variantId: variant.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        size: variant.size,
        sku: variant.sku,
        pricePaise: variant.pricePaise,
        mrpPaise: variant.mrpPaise,
        imageUrl,
        maxStock: variant.stock,
      }
    : null;

  const waHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Hi Avenues, I have a question about ${product.shortName} ${variant?.size ?? "50ml"}.`,
      )}`
    : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="micro-label-gold">
          {product.concentration}
          {variant && <> &middot; {variant.size}</>}
        </p>
        {/* Longevity as a scannable chip up top, not buried in the assurance
            list below — it is the single most asked question about a perfume. */}
        <span className="inline-flex items-center gap-1.5 border border-gold/35 px-2.5 py-1 font-sans text-[0.625rem] uppercase tracking-label text-gold">
          <Clock className="h-3 w-3" strokeWidth={1.6} />
          {product.longevity}
        </span>
      </div>

      <h1 className="mt-4 font-display text-d3 font-light text-bone">{product.name}</h1>
      <p className="mt-3 font-sans text-body-lg text-stone">{product.tagline}</p>

      {product.reviewCount > 0 && (
        <a href="#reviews" className="mt-4 inline-block">
          <Stars rating={product.avgRating} count={product.reviewCount} size="md" />
        </a>
      )}

      {/* Price */}
      {variant && (
        <div className="mt-7 border-y border-line py-6">
          <Price pricePaise={variant.pricePaise} mrpPaise={variant.mrpPaise} size="xl" />
          <p className="mt-2.5 font-sans text-xs text-stone-dark">
            MRP inclusive of all taxes &middot; Net quantity: {variant.size}
          </p>
        </div>
      )}

      {/* Variant selector — appears automatically the moment a second size is
          added in admin; stays hidden for a single-size product. */}
      {variants.length > 1 && (
        <fieldset className="mt-7">
          <legend className="micro-label mb-3">Size</legend>
          <div className="flex flex-wrap gap-2.5">
            {variants.map((v) => {
              const out = v.stock <= 0;
              const active = v.id === variantId;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setVariantId(v.id);
                    setQty(1);
                  }}
                  aria-pressed={active}
                  className={cn(
                    "relative border px-5 py-3 font-sans text-sm transition-all duration-400 ease-smoke",
                    active
                      ? "border-gold/60 bg-gold/10 text-gold-light"
                      : "border-line text-stone hover:border-line-strong hover:text-bone",
                    out && "opacity-45",
                  )}
                >
                  {v.size}
                  <span className="money ml-2 text-xs text-stone-dark">{formatPaise(v.pricePaise)}</span>
                  {out && (
                    <span className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-stone-dark" />
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* Stock signal */}
      {low && (
        <p className="mt-6 font-sans text-sm text-warning">
          Only {variant!.stock} left of this size.
        </p>
      )}

      {soldOut ? (
        <NotifyMe variantId={variant?.id ?? null} productName={product.shortName} />
      ) : (
        <>
          <div ref={actionsRef} className="mt-7 flex items-stretch gap-3">
            <div className="flex items-center border border-line">
              <StepButton
                label="Decrease quantity"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={1.6} />
              </StepButton>
              <span
                aria-live="polite"
                className="w-10 text-center font-sans text-sm tabular-nums text-bone"
              >
                {qty}
              </span>
              <StepButton
                label="Increase quantity"
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                disabled={qty >= maxQty}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.6} />
              </StepButton>
            </div>

            <AddToCartButton line={line} quantity={qty} className="btn-outline btn-md flex-1" />

            <WishlistButton
              productId={product.id}
              productName={product.shortName}
              size="lg"
              className="h-12 w-12 shrink-0"
            />
          </div>

          <AddToCartButton
            line={line}
            quantity={qty}
            buyNow
            className="btn-primary btn-lg mt-3 w-full"
          />
        </>
      )}

      {/* Reassurance */}
      <ul className="mt-8 space-y-3.5">
        <Assurance icon={<Clock className="h-4 w-4" strokeWidth={1.4} />}>
          {product.longevity} on skin from two sprays
        </Assurance>
        <Assurance icon={<Truck className="h-4 w-4" strokeWidth={1.4} />}>
          Free delivery above {formatPaise(freeShippingThresholdPaise)} across India
        </Assurance>
        {codEnabled && (
          <Assurance icon={<ShieldCheck className="h-4 w-4" strokeWidth={1.4} />}>
            Cash on delivery available
          </Assurance>
        )}
      </ul>

      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-7 inline-flex items-center gap-2.5 font-sans text-micro uppercase text-gold transition-colors hover:text-gold-light"
        >
          <WhatsAppIcon className="h-4 w-4" />
          Enquire on WhatsApp
        </a>
      )}

      {mounted &&
        createPortal(
          <StickyBuyBar
            visible={showSticky && !soldOut}
            name={product.shortName}
            size={variant?.size ?? ""}
            pricePaise={variant?.pricePaise ?? 0}
            line={line}
            quantity={qty}
          />,
          document.body,
        )}
    </div>
  );
}

/**
 * Mobile sticky bar. Rendered into document.body so it escapes any transformed
 * ancestor (a CSS transform breaks position: fixed).
 *
 * Publishes its height to --sticky-bar-h so the WhatsApp button and toasts lift
 * clear of it instead of sitting underneath.
 */
function StickyBuyBar({
  visible,
  name,
  size,
  pricePaise,
  line,
  quantity,
}: {
  visible: boolean;
  name: string;
  size: string;
  pricePaise: number;
  line: Parameters<typeof AddToCartButton>[0]["line"];
  quantity: number;
}) {
  useEffect(() => {
    document.documentElement.style.setProperty("--sticky-bar-h", visible ? "4.75rem" : "0px");
    return () => {
      document.documentElement.style.setProperty("--sticky-bar-h", "0px");
    };
  }, [visible]);

  return (
    <div
      className={cn(
        "glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 transition-transform duration-500 ease-smoke lg:hidden",
        visible ? "translate-y-0" : "translate-y-full",
      )}
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-3 px-4 py-3.5" style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}>
        <div className="min-w-0 flex-1">
          <p className="truncate font-sans text-sm text-bone">{name}</p>
          <p className="font-sans text-xs text-stone">
            {size} &middot; <span className="money">{formatPaise(pricePaise)}</span>
          </p>
        </div>
        <AddToCartButton
          line={line}
          quantity={quantity}
          className="btn-primary btn-md shrink-0"
          disabled={!visible}
        />
      </div>
    </div>
  );
}

function StepButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-12 w-11 items-center justify-center text-stone transition-colors
                 hover:text-gold-light disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Assurance({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 font-sans text-sm text-stone">
      <span className="text-gold/70">{icon}</span>
      {children}
    </li>
  );
}

/** Shown in place of Add to cart when a variant is out of stock. */
function NotifyMe({ variantId, productName }: { variantId: string | null; productName: string }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useUI((s) => s.toast);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!variantId || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/stock-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, email }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      toast({ title: "That didn't go through", description: "Try again in a moment.", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="mt-7 border border-gold/25 bg-gold/[0.04] p-5 font-sans text-sm leading-relaxed text-gold-light">
        We will write to you the moment {productName} is back.
      </p>
    );
  }

  return (
    <div className="mt-7">
      <p className="font-sans text-sm text-stone">
        Sold out for now. Leave your email and we will tell you the moment it is
        back — no other mail, ever.
      </p>
      <form onSubmit={submit} className="mt-4 flex gap-3">
        <label htmlFor="notify-email" className="sr-only">
          Email address
        </label>
        <input
          id="notify-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="field flex-1"
        />
        <button type="submit" disabled={busy} className="btn btn-outline btn-md shrink-0">
          {busy ? "Saving" : "Notify me"}
        </button>
      </form>
    </div>
  );
}
