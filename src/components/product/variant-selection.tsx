"use client";

import { createContext, useContext, useMemo, useState } from "react";

/**
 * Which size the shopper is currently looking at.
 *
 * The buy box owned this in local state, which was fine until anything else on
 * the page had to agree with it. The statutory Product information panel sits
 * in a different section entirely and was rendered server-side from the
 * default size, so a shopper who selected 100ml still read "Net quantity: 50ml,
 * MRP ₹999" further down the same page — a Legal Metrology declaration that
 * contradicted the price above it.
 *
 * Context rather than a global store: the selection belongs to one product
 * page and must not survive a navigation to the next one.
 */

export type SelectableVariant = {
  id: string;
  size: string;
  mrpPaise: number;
  pricePaise: number;
  stock: number;
};

type VariantSelection = {
  selectedId: string;
  select: (id: string) => void;
  /** The selected variant, or null when the product has no active sizes. */
  selected: SelectableVariant | null;
};

const Ctx = createContext<VariantSelection | null>(null);

/** The size a page opens on: the cheapest that can actually be bought. */
export function defaultVariantId(variants: { id: string; stock: number }[]) {
  return variants.find((v) => v.stock > 0)?.id ?? variants[0]?.id ?? "";
}

export function VariantSelectionProvider({
  variants,
  children,
}: {
  variants: SelectableVariant[];
  children: React.ReactNode;
}) {
  const [selectedId, setSelectedId] = useState(() => defaultVariantId(variants));

  const value = useMemo<VariantSelection>(
    () => ({
      selectedId,
      select: setSelectedId,
      selected: variants.find((v) => v.id === selectedId) ?? variants[0] ?? null,
    }),
    [selectedId, variants],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** For the buy box, which drives the selection. Requires a provider. */
export function useVariantSelection() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useVariantSelection must be used inside <VariantSelectionProvider>.");
  }
  return ctx;
}

/**
 * For anything that merely reflects the selection. Returns null outside a
 * provider so a component can still be rendered on a page that has no size
 * selector at all.
 */
export function useSelectedVariant() {
  return useContext(Ctx)?.selected ?? null;
}
