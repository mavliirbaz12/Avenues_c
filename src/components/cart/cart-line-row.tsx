"use client";

import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2 } from "lucide-react";
import { BottleFigure } from "@/components/brand/bottle-figure";
import { useCart } from "@/store/cart";
import { formatPaise } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PricedLine } from "@/lib/commerce/pricing";

export function CartLineRow({
  line,
  onNavigate,
  compact = false,
}: {
  line: PricedLine;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);

  const atStockLimit = line.quantity >= line.stock;

  return (
    <li className="flex gap-4 py-5">
      <Link
        href={line.type === "COMBO" ? `/set/${line.slug}` : `/fragrance/${line.slug}`}
        onClick={onNavigate}
        className={cn(
          "relative shrink-0 overflow-hidden border border-line bg-ink-deep",
          compact ? "h-24 w-20" : "h-32 w-28",
        )}
      >
        {line.imageUrl ? (
          <Image
            src={line.imageUrl}
            alt={line.name}
            fill
            sizes="112px"
            className="object-cover"
          />
        ) : (
          <BottleFigure slug={line.slug} />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={line.type === "COMBO" ? `/set/${line.slug}` : `/fragrance/${line.slug}`}
              onClick={onNavigate}
              className="font-display text-lg font-light leading-tight text-bone transition-colors hover:text-gold-light"
            >
              {line.name.replace(/^Avenues\s+/i, "")}
            </Link>
            <p className="mt-1 font-sans text-xs uppercase tracking-label text-stone-dark">
              {line.size}
            </p>
          </div>

          <button
            type="button"
            onClick={() => remove(line.variantId)}
            aria-label={`Remove ${line.name} from cart`}
            className="-mr-1 -mt-1 shrink-0 p-1.5 text-stone-dark transition-colors hover:text-danger"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.4} />
          </button>
        </div>

        {line.clampedFrom !== undefined && (
          <p className="mt-1.5 font-sans text-xs text-warning">
            Only {line.stock} left — quantity reduced.
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <div className="flex items-center border border-line">
            <Step
              label="Decrease quantity"
              onClick={() => setQuantity(line.variantId, line.quantity - 1)}
            >
              <Minus className="h-3 w-3" strokeWidth={1.8} />
            </Step>
            <span className="w-8 text-center font-sans text-sm tabular-nums text-bone">
              {line.quantity}
            </span>
            <Step
              label="Increase quantity"
              disabled={atStockLimit}
              onClick={() => setQuantity(line.variantId, line.quantity + 1)}
            >
              <Plus className="h-3 w-3" strokeWidth={1.8} />
            </Step>
          </div>

          <div className="text-right">
            <p className="font-sans text-sm text-bone tabular-nums">
              {formatPaise(line.totalPaise)}
            </p>
            {line.mrpPaise > line.unitPricePaise && (
              <p className="font-sans text-xs text-stone-dark line-through tabular-nums">
                {formatPaise(line.mrpPaise * line.quantity)}
              </p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function Step({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center text-stone transition-colors
                 hover:text-gold-light disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
