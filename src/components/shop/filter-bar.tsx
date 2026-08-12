"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X, SlidersHorizontal } from "lucide-react";
import { formatPaise } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Shop filters.
 *
 * Every option is derived from the database, never hardcoded — the day a
 * women's or unisex fragrance is added in admin, or a 100ml variant appears,
 * the corresponding filter shows up on its own.
 *
 * State lives entirely in the URL so results are shareable and the back
 * button behaves. The bar collapses behind a "Filter" toggle on mobile.
 */

export type FacetData = {
  genders: { value: string; label: string; count: number }[];
  sizes: { value: string; count: number }[];
  priceBuckets: { value: string; label: string; count: number }[];
};

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

export function FilterBar({
  facets,
  total,
  matched,
}: {
  facets: FacetData;
  total: number;
  matched: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [openOnMobile, setOpenOnMobile] = useState(false);

  const selected = useCallback(
    (key: string) => new Set((params.get(key) ?? "").split(",").filter(Boolean)),
    [params],
  );

  const push = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const toggle = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      const set = selected(key);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      if (set.size) next.set(key, [...set].join(","));
      else next.delete(key);
      push(next);
    },
    [params, selected, push],
  );

  const setSort = useCallback(
    (value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value === "featured") next.delete("sort");
      else next.set("sort", value);
      push(next);
    },
    [params, push],
  );

  const q = params.get("q");
  const activeCount =
    selected("gender").size + selected("size").size + selected("price").size + (q ? 1 : 0);

  function clearAll() {
    push(new URLSearchParams());
  }

  return (
    <div className="border-y border-line">
      <div className="shell flex items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setOpenOnMobile((o) => !o)}
            aria-expanded={openOnMobile}
            className="inline-flex items-center gap-2.5 font-sans text-micro uppercase text-bone lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4 text-gold" strokeWidth={1.4} />
            Filter
            {activeCount > 0 && <span className="text-gold">({activeCount})</span>}
          </button>

          <p className="hidden font-sans text-micro uppercase text-stone lg:block">
            {matched === total
              ? `${total} fragrance${total === 1 ? "" : "s"}`
              : `${matched} of ${total}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 font-sans text-micro uppercase text-stone transition-colors hover:text-gold-light"
            >
              Clear
              <X className="h-3 w-3" strokeWidth={1.6} />
            </button>
          )}

          <label className="flex items-center gap-2.5">
            <span className="hidden font-sans text-micro uppercase text-stone sm:inline">Sort</span>
            <select
              value={params.get("sort") ?? "featured"}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort products"
              className="cursor-pointer border border-line bg-surface-sunken px-3 py-2 font-sans text-xs text-bone
                         transition-colors hover:border-line-strong focus:border-gold/70 focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value} className="bg-surface-raised">
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className={cn("border-t border-line lg:border-t-0", !openOnMobile && "hidden lg:block")}>
        <div className="shell flex flex-wrap items-center gap-x-8 gap-y-4 py-4">
          {q && (
            <FacetGroup label="Search">
              <span className="inline-flex items-center gap-2 border border-gold/45 px-3.5 py-2 font-sans text-xs text-gold">
                &ldquo;{q}&rdquo;
              </span>
            </FacetGroup>
          )}

          <FacetGroup label="For">
            {facets.genders.map((g) => (
              <Chip
                key={g.value}
                active={selected("gender").has(g.value)}
                onClick={() => toggle("gender", g.value)}
                count={g.count}
              >
                {g.label}
              </Chip>
            ))}
          </FacetGroup>

          {/* Only rendered when there is more than one size in the catalogue —
              a filter with a single option is furniture, not a control. */}
          {facets.sizes.length > 1 && (
            <FacetGroup label="Size">
              {facets.sizes.map((s) => (
                <Chip
                  key={s.value}
                  active={selected("size").has(s.value)}
                  onClick={() => toggle("size", s.value)}
                  count={s.count}
                >
                  {s.value}
                </Chip>
              ))}
            </FacetGroup>
          )}

          {facets.priceBuckets.length > 1 && (
            <FacetGroup label="Price">
              {facets.priceBuckets.map((b) => (
                <Chip
                  key={b.value}
                  active={selected("price").has(b.value)}
                  onClick={() => toggle("price", b.value)}
                  count={b.count}
                >
                  {b.label}
                </Chip>
              ))}
            </FacetGroup>
          )}
        </div>
      </div>
    </div>
  );
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="micro-label mr-1">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
  count,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 border px-3.5 py-2 font-sans text-xs transition-all duration-400 ease-smoke",
        active
          ? "border-gold/60 bg-gold/10 text-gold-light"
          : "border-line text-stone hover:border-line-strong hover:text-bone",
      )}
    >
      {children}
      {typeof count === "number" && (
        <span className={cn("text-[0.625rem]", active ? "text-gold/70" : "text-stone-dark")}>
          {count}
        </span>
      )}
    </button>
  );
}

/** Shared by the shop page so bucket ids stay in sync between server and client. */
export function priceBucketLabel(min: number, max: number | null) {
  if (max === null) return `Above ${formatPaise(min)}`;
  return `${formatPaise(min)} – ${formatPaise(max)}`;
}
