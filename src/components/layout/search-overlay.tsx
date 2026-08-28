"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Search, X } from "lucide-react";
import { BottleFigure } from "@/components/brand/bottle-figure";
import { Sparkle } from "@/components/brand/sparkle";
import { useUI } from "@/store/ui";
import { formatPaise } from "@/lib/format";

type Result = {
  slug: string;
  name: string;
  shortName: string;
  tagline: string;
  gender: string;
  /** SINGLE or COMBO — a set gets a contents line instead of a size. */
  type: "SINGLE" | "COMBO";
  itemCount: number;
  /** Canonical route, computed server-side so both kinds link correctly. */
  href: string;
  pricePaise: number | null;
  size: string | null;
  inStock: boolean;
  imageUrl: string | null;
};

const SUGGESTIONS = ["Oud", "Vanilla", "Fresh", "Night", "Rose"];

export function SearchOverlay() {
  const open = useUI((s) => s.searchOpen);
  const close = useUI((s) => s.closeSearch);
  const reduce = useReducedMotion();
  const router = useRouter();

  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Reset when the overlay closes so it never reopens showing a stale query.
  useEffect(() => {
    if (!open) {
      setQ("");
      setResults([]);
      setTouched(false);
    }
  }, [open]);

  // Debounced search. AbortController prevents an earlier, slower response
  // from overwriting the results of a later keystroke.
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setResults(data.results ?? []);
        setTouched(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    close();
    router.push(`/shop?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
        >
          <button
            type="button"
            aria-label="Close search"
            onClick={close}
            className="absolute inset-0 bg-ink-deep/85"
            tabIndex={-1}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search fragrances"
            initial={reduce ? { opacity: 0 } : { y: -24, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: -16, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong absolute inset-x-0 top-0 border-x-0 border-t-0"
          >
            <div className="shell py-5">
              <form onSubmit={submit} className="flex items-center gap-4">
                <Search className="h-5 w-5 shrink-0 text-gold" strokeWidth={1.4} />
                <label htmlFor="site-search" className="sr-only">
                  Search fragrances by name or note
                </label>
                <input
                  ref={inputRef}
                  id="site-search"
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name or note — oud, vanilla, fresh"
                  autoComplete="off"
                  className="w-full bg-transparent py-2 font-display text-2xl font-light text-bone
                             placeholder:font-sans placeholder:text-base placeholder:text-stone-dark
                             focus:outline-none sm:text-3xl sm:placeholder:text-lg"
                />
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close search"
                  className="-mr-2 shrink-0 p-2 text-stone transition-colors hover:text-bone"
                >
                  <X className="h-5 w-5" strokeWidth={1.4} />
                </button>
              </form>
            </div>

            <div className="rule" />

            <div className="shell max-h-[min(60vh,32rem)] overflow-y-auto overscroll-contain py-6">
              {q.trim().length < 2 ? (
                <div>
                  <p className="micro-label mb-4">Try</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setQ(s)}
                        className="border border-line px-4 py-2 font-sans text-xs text-stone
                                   transition-colors duration-300 ease-smoke hover:border-gold/40 hover:text-gold-light"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : loading && results.length === 0 ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="skeleton h-16 w-16 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-3.5 w-40" />
                        <div className="skeleton h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : results.length === 0 && touched ? (
                <div className="py-8 text-center">
                  <Sparkle className="mx-auto h-3 w-3 text-gold/50" />
                  <p className="mt-4 font-display text-2xl font-light text-bone">
                    Nothing by that name
                  </p>
                  <p className="mx-auto mt-2 max-w-sm font-sans text-sm leading-relaxed text-stone">
                    We only make five, so the shelf is short. Try a note instead —
                    oud, vanilla, bergamot — or browse the whole range.
                  </p>
                  <Link href="/shop" onClick={close} className="btn btn-outline btn-sm mt-6">
                    Shop the range
                  </Link>
                </div>
              ) : (
                <ul className="space-y-1">
                  {results.map((r) => (
                    <li key={r.slug}>
                      <Link
                        href={r.href}
                        onClick={close}
                        className="group flex items-center gap-4 border border-transparent p-3
                                   transition-colors duration-400 ease-smoke hover:border-line hover:bg-surface/60"
                      >
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden bg-ink-deep">
                          {r.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <BottleFigure slug={r.slug} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-lg font-light text-bone transition-colors group-hover:text-gold-light">
                            {r.name}
                          </p>
                          <p className="truncate font-sans text-xs text-stone">{r.tagline}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          {r.pricePaise !== null && (
                            <p className="money text-sm text-bone">{formatPaise(r.pricePaise)}</p>
                          )}
                          {!r.inStock && (
                            <p className="font-sans text-[0.625rem] uppercase tracking-label text-stone-dark">
                              Sold out
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
