import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Monogram } from "@/components/brand/monogram";

/**
 * "Know Avenues" — the story teaser.
 *
 * Cut to ONE paragraph on purpose. The previous three near-verbatim restated
 * the opening of /about, and a teaser that paraphrases the page it teases
 * gives the reader no reason to click.
 *
 * Structurally distinct from the brand statement band above: that one is
 * full-bleed, centred and unclickable; this is an asymmetric block with a
 * hairline arrow link. Two full-width banners a screen apart would be the
 * repetition trap in a different key.
 *
 * The facts strip that used to live here now grounds the brand banner.
 */
export function BrandStory() {
  return (
    <section className="py-section" aria-labelledby="story-heading">
      <div className="shell grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
        <Reveal className="lg:col-span-5">
          <div className="relative flex h-full min-h-[16rem] items-center justify-center">
            <Monogram className="h-40 w-40 opacity-90 sm:h-52 sm:w-52" />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(24rem 24rem at 50% 50%, rgba(201,162,75,0.09), transparent 65%)",
              }}
            />
          </div>
        </Reveal>

        <div className="lg:col-span-7">
          <Reveal>
            <p className="micro-label-gold">Know Avenues</p>
            <h2 id="story-heading" className="mt-5 max-w-xl font-display text-d3 font-light text-bone">
              We would rather make five well than fifty quickly
            </h2>
          </Reveal>

          <Reveal delay={0.08}>
            <p className="mt-7 max-w-xl font-sans text-body-lg leading-relaxed text-stone">
              Good fragrance in India was either imported and priced like
              jewellery, or affordable and gone within the hour. We built for the
              gap in between — eau de parfum concentration, oils sourced
              properly, and formulations tested through a Mumbai summer rather
              than a European autumn.
            </p>
          </Reveal>

          <Reveal delay={0.16}>
            <Link
              href="/about"
              className="group mt-9 inline-flex items-center gap-3 font-sans text-micro uppercase text-gold transition-colors hover:text-gold-light"
            >
              Read the full story
              <ArrowRight
                className="h-4 w-4 transition-transform duration-600 ease-smoke group-hover:translate-x-1.5"
                strokeWidth={1.4}
              />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
