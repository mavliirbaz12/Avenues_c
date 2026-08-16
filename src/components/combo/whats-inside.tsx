"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ChevronDown, ArrowUpRight } from "lucide-react";
import { NotePyramid } from "@/components/product/note-pyramid";
import { Reveal } from "@/components/motion/reveal";
import { GoldArc } from "@/components/brand/gold-arc";
import { BottleFigure } from "@/components/brand/bottle-figure";
import { cn } from "@/lib/utils";
import type { ComboMember } from "@/lib/catalog";

/**
 * "What's inside" — one expandable card per fragrance in a set.
 *
 * TWO THINGS THIS DELIBERATELY DOES NOT DO
 *
 * 1. It does not assume a count. A set may hold two fragrances or ten, and the
 *    admin can change that at any time. So this is a single-column accordion
 *    rather than a grid: a 3-up grid looks composed at 3, 6 and 9 items and
 *    visibly broken at 4, 5 and 7. A stacked list is correct at every count,
 *    and it is also the better reading experience — each entry carries a note
 *    pyramid and a paragraph of prose, which a narrow grid cell cannot hold.
 *
 * 2. It does not store a copy of anything. Every name, tagline, note and line
 *    of narrative arrives from the referenced product row (see
 *    `toComboMembers`), so reformulating a fragrance updates every set that
 *    contains it without an admin remembering which boxes it is in.
 *
 * The first entry starts open, so the section explains itself without a click.
 */
export function WhatsInside({ members }: { members: ComboMember[] }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<string | null>(members[0]?.id ?? null);

  if (members.length === 0) return null;

  return (
    <section
      id="whats-inside"
      className="scroll-mt-[calc(var(--header-h)+2rem)] border-t border-line py-section"
      aria-labelledby="whats-inside-heading"
      data-testid="whats-inside"
    >
      <div className="shell">
        <Reveal className="text-center">
          <p className="micro-label-gold">In the box</p>
          <h2
            id="whats-inside-heading"
            className="mx-auto mt-5 max-w-xl font-display text-d3 font-light text-bone"
          >
            {/* Reads correctly at any count, including one. */}
            {members.length === 1
              ? "The one inside"
              : `The ${numberWord(members.length)} inside`}
          </h2>
          <p className="mx-auto mt-5 max-w-md font-sans text-body-lg leading-relaxed text-stone">
            Each one is the full fragrance, not a diluted tester. Open any of
            them to read how it wears.
          </p>
        </Reveal>

        <ul className="mx-auto mt-14 max-w-3xl border-t border-line">
          {members.map((m, i) => {
            const isOpen = open === m.id;
            return (
              <li key={m.id} className="border-b border-line" data-testid="combo-member">
                <Reveal delay={Math.min(i, 6) * 0.05}>
                  <h3>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`member-panel-${m.id}`}
                      onClick={() => setOpen(isOpen ? null : m.id)}
                      className="group flex w-full items-center gap-5 py-6 text-left"
                    >
                      {/* Thumbnail. Falls back to the drawn bottle, tinted per
                          fragrance, so a set with no photography still reads. */}
                      <span className="relative h-16 w-12 shrink-0 overflow-hidden">
                        {m.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.image.url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <BottleFigure slug={slugish(m.name)} className="h-full w-full" />
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="font-display text-2xl font-light text-bone transition-colors duration-400 group-hover:text-gold-light">
                            {m.shortName}
                          </span>
                          <span className="micro-label text-gold">{m.sizeLabel}</span>
                        </span>
                        <span className="mt-1 block font-sans text-[0.6875rem] uppercase tracking-label text-stone">
                          {m.tagline}
                        </span>
                      </span>

                      <ChevronDown
                        aria-hidden="true"
                        strokeWidth={1.5}
                        className={cn(
                          "h-4 w-4 shrink-0 text-stone transition-transform duration-400 ease-smoke",
                          isOpen && "rotate-180",
                        )}
                      />
                    </button>
                  </h3>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`member-panel-${m.id}`}
                        initial={reduce ? undefined : { height: 0, opacity: 0 }}
                        animate={reduce ? undefined : { height: "auto", opacity: 1 }}
                        exit={reduce ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="pb-9">
                          {m.sensoryNarrative && (
                            <p className="max-w-2xl font-sans text-body-lg leading-relaxed text-stone">
                              {m.sensoryNarrative}
                            </p>
                          )}

                          <NotePyramid
                            top={m.notes.top}
                            heart={m.notes.heart}
                            base={m.notes.base}
                            className="mt-8"
                          />

                          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                            {m.bestFor && (
                              <p className="font-sans text-xs text-stone-dark">
                                <span className="micro-label mr-2">Best for</span>
                                {m.bestFor}
                              </p>
                            )}

                            {/* Null href means the fragrance is no longer sold
                                on its own — the identity stays, the dead link
                                does not. */}
                            {m.href && (
                              <Link
                                href={m.href}
                                className="inline-flex items-center gap-1.5 font-sans text-micro uppercase text-gold transition-colors hover:text-gold-light"
                              >
                                Read the full page
                                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.6} />
                              </Link>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Reveal>
              </li>
            );
          })}
        </ul>

        <GoldArc className="mt-16" />
      </div>
    </section>
  );
}

/** Spelled-out counts read better than digits in a display heading. */
function numberWord(n: number) {
  const words = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
  ];
  return words[n] ?? String(n);
}

/** BottleFigure tints per slug; derive one when a member has no photo. */
function slugish(name: string) {
  return name
    .replace(/^Avenues\s+/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
