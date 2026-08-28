import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { BrandMark } from "@/components/brand/brand-mark";
import { GoldArc } from "@/components/brand/gold-arc";
import { Reveal } from "@/components/motion/reveal";
import { BottleFigure } from "@/components/brand/bottle-figure";
import { siteUrl } from "@/lib/env";
import { getStoreSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Our story",
  description:
    "Why Avenues makes a short catalogue instead of a long one, and what it takes to build eau de parfum for Indian weather.",
  alternates: { canonical: `${siteUrl}/about` },
};

const PRINCIPLES = [
  {
    title: "Eau de parfum, or nothing",
    body: "Concentration is the difference between a fragrance and a rumour of one. Everything we bottle is eau de parfum strength — the reason two sprays last a working day.",
  },
  {
    title: "Built for this climate",
    body: "A scent that behaves in a Paris autumn falls apart in a Chennai June. Ours are formulated and worn-tested through Indian summers — heat, humidity, commutes — before they earn a label.",
  },
  {
    title: "Short, done properly",
    body: "A small catalogue is not a limitation; it is the discipline. Every fragrance has to be somebody's signature, or it doesn't ship.",
  },
  {
    title: "Priced like we mean it",
    body: "Good oils, honest concentration, and a price that doesn't pretend the bottle crossed three oceans. Luxury is the liquid, not the markup.",
  },
];

export default async function AboutPage() {
  const settings = await getStoreSettings();

  return (
    <>
      {/* Opening statement */}
      <section className="relative overflow-hidden py-section">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(50rem 34rem at 50% 0%, rgba(201,162,75,0.08), transparent 65%)",
          }}
        />
        <div className="shell relative z-[2] mx-auto max-w-3xl text-center">
          <Reveal>
            <BrandMark className="mx-auto h-16 w-auto" />
            <p className="micro-label-gold mt-8">Our story</p>
            <h1 className="mt-5 font-display text-d2 font-light text-bone">
              Perfume in India deserved better than the in-between
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mx-auto mt-8 max-w-2xl space-y-5 text-left font-sans text-body-lg leading-relaxed text-stone">
              <p>
                Avenues started with a shelf. On one end: imported bottles priced
                like jewellery, formulated for climates we don&rsquo;t live in.
                On the other: sprays that smelled promising for forty minutes and
                then quietly left. The middle was almost empty.
              </p>
              <p>
                So we built for the middle. Every composition goes through Indian
                summers on real skin — office days, wedding evenings, long
                commutes — and is reformulated until it survives them.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <GoldArc label="What we hold to" />

      {/* Principles */}
      <section className="py-section" aria-label="Our principles">
        <div className="shell grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2">
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.06} className="bg-ink">
              <div className="h-full p-8 sm:p-10">
                <span className="font-sans text-micro text-stone-dark">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="mt-4 font-display text-d5 font-light text-bone">{p.title}</h2>
                <p className="mt-3 font-sans text-[0.9375rem] leading-relaxed text-stone">
                  {p.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Closing */}
      <section className="border-t border-line bg-ink-deep py-section grain">
        <div className="shell relative z-[2] grid items-center gap-12 lg:grid-cols-2">
          {/*
            The brand photograph, not the drawn bottle.

            BottleFigure is a hand-built SVG — it exists so a page never shows a
            grey box, and it does that job well in order rows and empty states.
            But this is the closing statement of the page that explains the
            brand, and a drawing of a bottle is the one thing here that is not
            the real product. The same photograph already opens the landing
            page, so the two pages now close and open on the same image, which
            reads as a motif rather than a repeat.

            Falls back to the drawing when the setting is empty, exactly as the
            hero does — the page must never render a hole.
          */}
          <Reveal className="mx-auto w-full max-w-[22rem] lg:max-w-none">
            {settings.brandBannerUrl ? (
              <div className="relative aspect-[1600/1283] w-full overflow-hidden">
                <Image
                  src={settings.brandBannerUrl}
                  alt="The Avenues range — eau de parfum bottles and the discovery set."
                  fill
                  sizes="(max-width: 1024px) 92vw, 45vw"
                  className="object-contain object-center"
                />
              </div>
            ) : (
              <div className="mx-auto w-full max-w-[16rem]">
                <BottleFigure slug="white-oud" alt="An Avenues eau de parfum bottle" />
              </div>
            )}
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="max-w-md font-display text-d3 font-light text-bone">
              The catalogue is short. Choosing shouldn&rsquo;t take long either.
            </h2>
            {/* Was "bold, soft, sweet, clean or rich" — one adjective per
                product, so it quietly became wrong the day a sixth shipped. */}
            <p className="mt-5 max-w-md font-sans text-body-lg leading-relaxed text-stone">
              Start with how you want to arrive, and the rest follows.
            </p>
            <Link href="/shop" className="btn btn-primary btn-lg mt-9">
              Meet the range
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
